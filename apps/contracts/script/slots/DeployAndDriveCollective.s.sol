// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SplitsWarehouse} from "splits-v2/SplitsWarehouse.sol";
import {SplitV2Lib} from "splits-v2/libraries/SplitV2.sol";

import {SlotCollective} from "../../src/collectives/SlotCollective.sol";
import {SlotCollectiveFactory} from "../../src/collectives/SlotCollectiveFactory.sol";
import {IManagedSlot} from "../../src/collectives/SlotGovernance.sol";

import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";

/**
 * @title DeployAndDriveCollective
 * @notice Puts a live collective on the local chain and pulls every lever the
 *         indexer claims to watch.
 *
 *   ./scripts/slots-local.sh                       # protocol first
 *   forge script script/slots/DeployAndDriveCollective.s.sol:DeployAndDriveCollective \
 *     --rpc-url http://127.0.0.1:8545 --broadcast \
 *     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
 *     --sig "run(address,address)" $SLOT_FACTORY $MIN_TENURE_HOOK
 *
 * @dev ── Why this is a script and not a test ────────────────────────────────
 *
 *      `test/CollectiveGovernsRealSlot.t.sol` proves the contracts agree with
 *      each other. It cannot prove the INDEXER agrees with them: a test's logs
 *      are thrown away with the EVM that produced them. Handlers are only
 *      verifiable against logs that are actually on a chain, in blocks, with
 *      transaction hashes an indexer can key rows by — so the same sequence has
 *      to be run for real.
 *
 *      ── One actor per role, deliberately ────────────────────────────────────
 *
 *      Each lever is pulled by a DIFFERENT anvil account, and none of them is
 *      the deployer. The relay events carry `by`, and the whole argument for
 *      indexing them is that `by` is not `transaction.from` in the cases that
 *      matter. Driving everything from account 0 would make the two columns
 *      agree by accident and verify nothing: a handler reading the wrong field
 *      would produce identical rows.
 *
 *      ── The sequence, and what each step is there to catch ──────────────────
 *
 *        1. deploy a warehouse, a collective implementation and a factory
 *        2. mint a collective with TWO payees          → split membership
 *        3. create a slot naming it manager AND recipient
 *        4. proposeTax(750)          [tax manager]     → UpdateRelayed(Tax)
 *        5. proposeHook(minTenure)   [hook manager]    → UpdateRelayed(Hook)
 *        6. cancelHookProposal       [hook manager]    → the port's whole point:
 *           the tax manager's queued 750 must SURVIVE a hook cancel
 *        7. a real buy                                 → TermsApplied lands 750
 *        8. proposeTax(900)          [tax manager]
 *        9. cancelAllProposals       [admin]           → PendingUpdatesCancelled
 *       10. setSplit down to ONE payee [split manager] → the shrink path, which
 *           is the only thing that exercises the recipient tail delete
 *       11. fund + distribute                          → SplitDistributed
 *       12. setPaused(true)          [split manager]   → SetPaused
 *
 *      Step 6 before step 7 is not arbitrary. If the cancel took the tax
 *      proposal with it, the buy in step 7 would apply nothing and the slot
 *      would still read 500 — which is exactly the regression the port fixed,
 *      and it would show up here as a row rather than as a revert.
 */
contract DeployAndDriveCollective is Script {
    // Anvil's default accounts. Fixed, funded, and public — the point is that
    // each role is a different address, not that the keys are secret.
    uint256 constant PK_ADMIN =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant PK_TAX_MGR =
        0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 constant PK_HOOK_MGR =
        0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
    uint256 constant PK_SPLIT_MGR =
        0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;
    uint256 constant PK_BUYER =
        0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e;

    address constant PAYEE_A = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
    address constant PAYEE_B = 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc;

    uint256 constant PRICE = 0.1 ether;
    uint256 constant TAX_AT_BIRTH = 500;
    uint256 constant TAX_PROPOSED = 750;
    uint256 constant TAX_PROPOSED_AGAIN = 900;

    address admin = vm.addr(PK_ADMIN);
    address taxMgr = vm.addr(PK_TAX_MGR);
    address hookMgr = vm.addr(PK_HOOK_MGR);
    address splitMgr = vm.addr(PK_SPLIT_MGR);
    address buyer = vm.addr(PK_BUYER);

    SlotCollective collective;
    Slot slot;

    /**
     * @param slotFactoryAddr The already-deployed `SlotFactory` — printed by
     *        `DeploySlots`, and in `deployments/31337/SlotFactory.json`.
     * @param hookAddr A hook that answers `hooks()`. The slot validates it at
     *        propose time, so a contract that cannot answer is refused there
     *        rather than here.
     */
    function run(address slotFactoryAddr, address hookAddr) external {
        uint256 startBlock = block.number;

        // ── 1. the collective's own plumbing ───────────────────────────────
        //
        // Deployed here rather than in `DeploySlots` because a collective needs
        // a `SplitsWarehouse`, which is 0xSplits infrastructure and has no
        // business being minted by the protocol's own deploy on a real chain.
        vm.startBroadcast(PK_ADMIN);

        SplitsWarehouse warehouse = new SplitsWarehouse("Ether", "ETH");
        SlotCollectiveFactory collectiveFactory = SlotCollectiveFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotCollectiveFactory()),
                    abi.encodeCall(
                        SlotCollectiveFactory.initialize,
                        (admin, address(new SlotCollective(address(warehouse))))
                    )
                )
            )
        );

        // ── 2. a collective with two payees and one holder per role ─────────
        collective = SlotCollective(
            payable(collectiveFactory.createManager(_twoPayees(), _roles()))
        );

        // ── 3. a slot that names it BOTH manager and recipient ─────────────
        slot = Slot(
            payable(
                SlotFactory(slotFactoryAddr).createSlot(
                    SlotInit({
                        recipient: address(collective),
                        currency: IERC20(address(0)),
                        manager: address(collective),
                        hook: address(0),
                        taxPercentage: TAX_AT_BIRTH,
                        minDepositSeconds: 1 days,
                        mutableTax: true,
                        mutableHook: true
                    })
                )
            )
        );

        vm.stopBroadcast();

        // ── 4-6. the governance sequence ───────────────────────────────────
        vm.broadcast(PK_TAX_MGR);
        collective.proposeTax(IManagedSlot(address(slot)), TAX_PROPOSED);

        vm.broadcast(PK_HOOK_MGR);
        collective.proposeHook(IManagedSlot(address(slot)), hookAddr);

        vm.broadcast(PK_HOOK_MGR);
        collective.cancelHookProposal(IManagedSlot(address(slot)));

        // The assertion the port turns on, checked against the live chain
        // rather than against a fixture. If this trips, nothing downstream is
        // worth indexing.
        (uint256 pendingTax, , bool hasTax, bool hasHook, ) = slot.pending();
        require(hasTax, "the tax manager's proposal did not survive");
        require(pendingTax == TAX_PROPOSED, "wrong tax survived");
        require(!hasHook, "the hook proposal was not cancelled");

        // ── 7. a real buy, so the surviving proposal lands ──────────────────
        // Both reads are hoisted above the broadcast on purpose: forge refuses a
        // staticcall once `vm.broadcast` has armed the next transaction, and
        // `quoteBuy` inside the call arguments is exactly that.
        uint256 need = slot.minDepositForBuy(PRICE);
        uint256 cost = slot.quoteBuy(address(this), need);
        vm.broadcast(PK_BUYER);
        slot.buy{value: cost}(buyer, need, PRICE, 0);
        require(
            slot.taxPercentage() == TAX_PROPOSED,
            "TermsApplied did not land the surviving tax"
        );

        // ── 8-9. propose again, then the admin's blanket cancel ────────────
        vm.broadcast(PK_TAX_MGR);
        collective.proposeTax(IManagedSlot(address(slot)), TAX_PROPOSED_AGAIN);

        vm.broadcast(PK_ADMIN);
        collective.cancelAllProposals(IManagedSlot(address(slot)));

        (, , bool leftTax, bool leftHook, ) = slot.pending();
        require(!leftTax && !leftHook, "cancelAllProposals left something");

        // ── 10. shrink the split ───────────────────────────────────────────
        //
        // Two payees down to one. Growing a split proves nothing about the
        // tail: the stale row only appears when the new split is SHORTER, and
        // an indexer that forgets to delete it keeps paying a phantom payee on
        // paper forever.
        SplitV2Lib.Split memory onePayee = _onePayee();
        vm.broadcast(PK_SPLIT_MGR);
        collective.setSplit(onePayee);

        // ── 11. money out ──────────────────────────────────────────────────
        vm.broadcast(PK_ADMIN);
        payable(address(collective)).transfer(1 ether);

        address nativeToken = warehouse.NATIVE_TOKEN();
        vm.broadcast(PK_ADMIN);
        collective.distribute(onePayee, nativeToken, admin);

        // ── 12. and the pause flag ─────────────────────────────────────────
        vm.broadcast(PK_SPLIT_MGR);
        collective.setPaused(true);

        _record("SlotCollectiveFactory", address(collectiveFactory), startBlock);
        _record("SplitsWarehouse", address(warehouse), startBlock);

        console2.log("");
        console2.log("COLLECTIVE_FACTORY ", address(collectiveFactory));
        console2.log("COLLECTIVE         ", address(collective));
        console2.log("SLOT               ", address(slot));
        console2.log("WAREHOUSE          ", address(warehouse));
        console2.log("ADMIN              ", admin);
        console2.log("TAX_MANAGER        ", taxMgr);
        console2.log("HOOK_MANAGER       ", hookMgr);
        console2.log("SPLIT_MANAGER      ", splitMgr);
        console2.log("BUYER              ", buyer);
        console2.log("PAYEE_A            ", PAYEE_A);
        console2.log("PAYEE_B            ", PAYEE_B);
        console2.log("START_BLOCK        ", startBlock);
    }

    function _twoPayees() internal pure returns (SplitV2Lib.Split memory s) {
        address[] memory r = new address[](2);
        r[0] = PAYEE_A;
        r[1] = PAYEE_B;
        uint256[] memory a = new uint256[](2);
        a[0] = 70;
        a[1] = 30;
        s = SplitV2Lib.Split({
            recipients: r,
            allocations: a,
            totalAllocation: 100,
            distributionIncentive: 0
        });
    }

    function _onePayee() internal pure returns (SplitV2Lib.Split memory s) {
        address[] memory r = new address[](1);
        r[0] = PAYEE_A;
        uint256[] memory a = new uint256[](1);
        a[0] = 100;
        s = SplitV2Lib.Split({
            recipients: r,
            allocations: a,
            totalAllocation: 100,
            distributionIncentive: 0
        });
    }

    function _roles()
        internal
        view
        returns (SlotCollective.InitialRoles memory r)
    {
        address[] memory tax = new address[](1);
        tax[0] = taxMgr;
        // `hookManagers`, which the initializer grants POLICY_MANAGER_ROLE.
        // The parameter renamed and the role did not — see SlotGovernance.
        address[] memory hooks = new address[](1);
        hooks[0] = hookMgr;
        address[] memory splits = new address[](1);
        splits[0] = splitMgr;
        r = SlotCollective.InitialRoles({
            admin: admin,
            taxManagers: tax,
            hookManagers: hooks,
            splitManagers: splits
        });
    }

    /// @dev Same shape `DeploySlots` writes, and what the indexer's local
    ///      config reads to find the collective factory — its address is a
    ///      function of when this ran, so it cannot be a constant anywhere.
    function _record(
        string memory name,
        address addr,
        uint256 startBlock
    ) internal {
        string memory obj = name;
        vm.serializeAddress(obj, "address", addr);
        string memory json = vm.serializeUint(obj, "startBlock", startBlock);
        vm.writeFile(
            string.concat(
                "./deployments/",
                vm.toString(block.chainid),
                "/",
                name,
                ".json"
            ),
            json
        );
    }
}
