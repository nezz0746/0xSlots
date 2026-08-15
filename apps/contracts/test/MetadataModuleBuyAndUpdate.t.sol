// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {MetadataModule} from "../src/modules/MetadataModule.sol";
import {Slot} from "../src/Slot.sol";
import {SlotFactory} from "../src/SlotFactory.sol";
import {SlotConfig, SlotInitParams} from "../src/interfaces/ISlot.sol";
import "../src/interfaces/SlotErrors.sol";

contract PermitToken is ERC20, ERC20Permit {
    constructor() ERC20("Permit", "PRM") ERC20Permit("Permit") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice `buyAndUpdate` / `buyAndUpdateWithPermit` — the one-call path.
///
/// @dev What these cover that `MetadataModule.t.sol` does not is the SEAM: the
///      module buys on the caller's behalf and then writes metadata without
///      consulting `onlyOccupant`. That skip is only sound because `Slot.buy`
///      either seated `msg.sender` or reverted, so the tests that matter most
///      here are the ones proving the second half cannot happen without the
///      first — see the `_bypass` group at the bottom.
contract MetadataModuleBuyAndUpdateTest is Test {
    MetadataModule module;
    SlotFactory factory;
    PermitToken token;

    address recipient = makeAddr("recipient");
    address manager = makeAddr("manager");
    address alice = makeAddr("alice");

    // Needs a known key: the permit tests sign as this account.
    uint256 bobKey = 0xB0B;
    address bob;

    uint256 constant PRICE = 100 ether;
    uint256 constant DEPOSIT = 10 ether;

    bytes32 constant PERMIT_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );

    function setUp() public {
        bob = vm.addr(bobKey);

        MetadataModule impl = new MetadataModule();
        module = MetadataModule(
            address(
                new ERC1967Proxy(
                    address(impl),
                    abi.encodeCall(MetadataModule.initialize, (address(this)))
                )
            )
        );

        Slot slotImpl = new Slot();
        factory = SlotFactory(
            address(
                new ERC1967Proxy(
                    address(new SlotFactory()),
                    abi.encodeCall(
                        SlotFactory.initialize,
                        (address(this), address(slotImpl))
                    )
                )
            )
        );

        token = new PermitToken();
        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
    }

    // ── helpers ───────────────────────────────────────────────

    function _createSlot(IERC20 currency) internal returns (Slot) {
        return
            Slot(
                factory.createSlot(
                    recipient,
                    currency,
                    SlotConfig({
                        mutableTax: true,
                        mutableUtility: true,
                        mutablePolicy: false,
                        manager: manager
                    }),
                    SlotInitParams({
                        taxPercentage: 100,
                        utility: address(module),
                        liquidationBountyBps: 500,
                        minDepositSeconds: 86400,
                        occupancyPolicy: address(0)
                    })
                )
            );
    }

    function _erc20Slot() internal returns (Slot) {
        return _createSlot(IERC20(address(token)));
    }

    function _nativeSlot() internal returns (Slot) {
        return _createSlot(IERC20(address(0)));
    }

    /// @dev Occupy `slot` the ordinary two-step way, so the buy under test is
    ///      exercised against an OCCUPIED slot rather than a vacant one.
    function _seat(Slot slot, address who, string memory uri) internal {
        vm.startPrank(who);
        token.approve(address(slot), DEPOSIT + slot.price());
        slot.buy(who, DEPOSIT, PRICE);
        module.updateMetadata(address(slot), uri);
        vm.stopPrank();
    }

    function _seatNative(Slot slot, address who, string memory uri) internal {
        uint256 owed = slot.occupant() == address(0)
            ? DEPOSIT
            : DEPOSIT + slot.price();
        vm.startPrank(who);
        slot.buy{value: owed}(who, DEPOSIT, PRICE);
        module.updateMetadata(address(slot), uri);
        vm.stopPrank();
    }

    function _signPermit(
        uint256 key,
        address spender,
        uint256 value,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        address ownerAddr = vm.addr(key);
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                ownerAddr,
                spender,
                value,
                token.nonces(ownerAddr),
                deadline
            )
        );
        return
            vm.sign(
                key,
                MessageHashUtils.toTypedDataHash(
                    token.DOMAIN_SEPARATOR(),
                    structHash
                )
            );
    }

    // ═══════════════════════════════════════════════════════════
    // ERC-20
    // ═══════════════════════════════════════════════════════════

    function test_buyAndUpdate_vacantErc20() public {
        Slot slot = _erc20Slot();
        uint256 before = token.balanceOf(alice);

        vm.startPrank(alice);
        token.approve(address(module), DEPOSIT);
        module.buyAndUpdate(address(slot), DEPOSIT, PRICE, "ipfs://alice");
        vm.stopPrank();

        assertEq(slot.occupant(), alice, "buyer is seated, not the module");
        assertEq(slot.price(), PRICE);
        assertEq(slot.deposit(), DEPOSIT);
        assertEq(module.tokenURI(address(slot)), "ipfs://alice");
        // Vacant slots cost the deposit alone.
        assertEq(token.balanceOf(alice), before - DEPOSIT);
    }

    function test_buyAndUpdate_occupiedErc20() public {
        Slot slot = _erc20Slot();
        _seat(slot, alice, "ipfs://alice");

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);
        uint256 owed = PRICE + DEPOSIT;

        vm.startPrank(bob);
        token.approve(address(module), owed);
        module.buyAndUpdate(address(slot), DEPOSIT, PRICE, "ipfs://bob");
        vm.stopPrank();

        assertEq(slot.occupant(), bob);
        // The URI written here is bob's, NOT an empty string: `Slot.buy` fires
        // `onTransfer` at this module partway through and that clears the entry.
        // The whole design depends on the write landing after the buy returns.
        assertEq(module.tokenURI(address(slot)), "ipfs://bob");
        assertEq(token.balanceOf(bob), bobBefore - owed);
        // Alice is bought out: her deposit back, plus the price bob paid.
        assertEq(token.balanceOf(alice), aliceBefore + DEPOSIT + PRICE);
    }

    function test_buyAndUpdate_leavesNoAllowanceOrBalanceBehind() public {
        Slot slot = _erc20Slot();

        vm.startPrank(alice);
        token.approve(address(module), DEPOSIT);
        module.buyAndUpdate(address(slot), DEPOSIT, PRICE, "ipfs://alice");
        vm.stopPrank();

        assertEq(
            token.allowance(address(module), address(slot)),
            0,
            "no standing allowance"
        );
        assertEq(token.balanceOf(address(module)), 0, "no stranded tokens");
    }

    function test_buyAndUpdate_rejectsValueOnErc20Slot() public {
        Slot slot = _erc20Slot();

        vm.startPrank(alice);
        token.approve(address(module), DEPOSIT);
        vm.expectRevert(MetadataModule.UnexpectedValue.selector);
        module.buyAndUpdate{value: 1 ether}(
            address(slot),
            DEPOSIT,
            PRICE,
            "ipfs://alice"
        );
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════
    // NATIVE
    // ═══════════════════════════════════════════════════════════

    function test_buyAndUpdate_vacantNative() public {
        Slot slot = _nativeSlot();
        uint256 before = alice.balance;

        vm.prank(alice);
        module.buyAndUpdate{value: DEPOSIT}(
            address(slot),
            DEPOSIT,
            PRICE,
            "ipfs://alice"
        );

        assertEq(slot.occupant(), alice);
        assertEq(module.tokenURI(address(slot)), "ipfs://alice");
        assertEq(alice.balance, before - DEPOSIT);
        assertEq(address(module).balance, 0, "module keeps no ETH");
    }

    function test_buyAndUpdate_occupiedNative() public {
        Slot slot = _nativeSlot();
        _seatNative(slot, alice, "ipfs://alice");

        uint256 aliceBefore = alice.balance;
        uint256 owed = PRICE + DEPOSIT;

        vm.prank(bob);
        module.buyAndUpdate{value: owed}(
            address(slot),
            DEPOSIT,
            PRICE,
            "ipfs://bob"
        );

        assertEq(slot.occupant(), bob);
        assertEq(module.tokenURI(address(slot)), "ipfs://bob");
        assertEq(alice.balance, aliceBefore + DEPOSIT + PRICE);
        assertEq(address(module).balance, 0);
    }

    /// @dev `Slot.buy` wants `msg.value` EXACTLY. The module forwards verbatim
    ///      rather than recomputing, so being wrong has to surface as the slot's
    ///      own error — not as ETH quietly retained here.
    function test_buyAndUpdate_nativeRejectsWrongValue() public {
        Slot slot = _nativeSlot();

        vm.prank(alice);
        vm.expectRevert(InvalidValue.selector);
        module.buyAndUpdate{value: DEPOSIT - 1}(
            address(slot),
            DEPOSIT,
            PRICE,
            "ipfs://alice"
        );

        assertEq(address(module).balance, 0);
    }

    // ═══════════════════════════════════════════════════════════
    // PERMIT
    // ═══════════════════════════════════════════════════════════

    function test_buyAndUpdateWithPermit_needsNoPriorApproval() public {
        Slot slot = _erc20Slot();
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(
            bobKey,
            address(module),
            DEPOSIT,
            deadline
        );

        assertEq(token.allowance(bob, address(module)), 0, "starts unapproved");

        vm.prank(bob);
        module.buyAndUpdateWithPermit(
            address(slot),
            DEPOSIT,
            PRICE,
            "ipfs://bob",
            DEPOSIT,
            deadline,
            v,
            r,
            s
        );

        assertEq(slot.occupant(), bob);
        assertEq(module.tokenURI(address(slot)), "ipfs://bob");
    }

    /// @dev A permit is a public signature; anyone can land it first. That is
    ///      not an attack — it grants the same allowance — so the call must
    ///      shrug and continue rather than revert on the spent nonce.
    function test_buyAndUpdateWithPermit_survivesFrontRunPermit() public {
        Slot slot = _erc20Slot();
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(
            bobKey,
            address(module),
            DEPOSIT,
            deadline
        );

        // Someone else submits bob's permit before he can.
        vm.prank(alice);
        IERC20Permit(address(token)).permit(
            bob,
            address(module),
            DEPOSIT,
            deadline,
            v,
            r,
            s
        );

        vm.prank(bob);
        module.buyAndUpdateWithPermit(
            address(slot),
            DEPOSIT,
            PRICE,
            "ipfs://bob",
            DEPOSIT,
            deadline,
            v,
            r,
            s
        );

        assertEq(slot.occupant(), bob);
        assertEq(module.tokenURI(address(slot)), "ipfs://bob");
    }

    /// @dev The permit is swallowed, so a bad one must still fail — just later,
    ///      as the token's own transfer error rather than a signature error.
    function test_buyAndUpdateWithPermit_stillFailsWithoutAllowance() public {
        Slot slot = _erc20Slot();
        uint256 deadline = block.timestamp + 1 hours;
        // Signed by alice, presented by bob: a valid signature for the wrong
        // owner, which grants bob nothing.
        uint256 aliceKey = 0xA11CE;
        vm.prank(vm.addr(aliceKey));
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(
            aliceKey,
            address(module),
            DEPOSIT,
            deadline
        );

        vm.prank(bob);
        vm.expectRevert();
        module.buyAndUpdateWithPermit(
            address(slot),
            DEPOSIT,
            PRICE,
            "ipfs://bob",
            DEPOSIT,
            deadline,
            v,
            r,
            s
        );

        assertEq(slot.occupant(), address(0), "slot untouched");
        assertEq(module.tokenURI(address(slot)), "");
    }

    function test_buyAndUpdateWithPermit_rejectsNativeSlot() public {
        Slot slot = _nativeSlot();

        vm.prank(bob);
        vm.expectRevert(MetadataModule.NativeSlotHasNoPermit.selector);
        module.buyAndUpdateWithPermit(
            address(slot),
            DEPOSIT,
            PRICE,
            "ipfs://bob",
            DEPOSIT,
            block.timestamp + 1 hours,
            27,
            bytes32(0),
            bytes32(0)
        );
    }

    // ═══════════════════════════════════════════════════════════
    // THE BYPASS — that `_setMetadata` skips `onlyOccupant` is only
    // sound if it is unreachable without a completed buy.
    // ═══════════════════════════════════════════════════════════

    /// @dev A buy that reverts must take the metadata write with it. If these
    ///      ever came apart, the module would be a way to write any slot's URI
    ///      without holding it.
    function test_bypass_failedBuyWritesNothing() public {
        Slot slot = _erc20Slot();
        _seat(slot, alice, "ipfs://alice");

        vm.startPrank(bob);
        token.approve(address(module), PRICE + DEPOSIT);
        // Zero deposit against a slot with `minDepositSeconds` set.
        vm.expectRevert(InsufficientDeposit.selector);
        module.buyAndUpdate(address(slot), 0, PRICE, "ipfs://bob");
        vm.stopPrank();

        assertEq(slot.occupant(), alice, "alice still holds it");
        assertEq(
            module.tokenURI(address(slot)),
            "ipfs://alice",
            "her creative is untouched"
        );
    }

    /// @dev The same, through the price check rather than the deposit one.
    ///
    ///      Needs the allowance in place to be a test of anything: the module
    ///      pulls payment BEFORE calling `buy`, so without it the call dies on
    ///      the token and never reaches the slot's own validation.
    function test_bypass_invalidPriceWritesNothing() public {
        Slot slot = _erc20Slot();
        _seat(slot, alice, "ipfs://alice");

        vm.startPrank(bob);
        token.approve(address(module), PRICE + DEPOSIT);
        vm.expectRevert(InvalidPrice.selector);
        module.buyAndUpdate(address(slot), DEPOSIT, 0, "ipfs://bob");
        vm.stopPrank();

        assertEq(module.tokenURI(address(slot)), "ipfs://alice");
        assertEq(token.balanceOf(address(module)), 0, "buyer's funds returned");
    }

    /// @dev `Slot` refuses a self-purchase, so the occupant cannot reach the
    ///      write this way. They do not need to — `updateMetadata` is theirs.
    function test_bypass_occupantCannotBuyFromThemselves() public {
        Slot slot = _erc20Slot();
        _seat(slot, alice, "ipfs://alice");

        vm.startPrank(alice);
        token.approve(address(module), PRICE + DEPOSIT);
        vm.expectRevert(CannotBuyFromYourself.selector);
        module.buyAndUpdate(address(slot), DEPOSIT, PRICE, "ipfs://again");
        vm.stopPrank();
    }

    /// @dev Regression: the modifier still guards the direct entry point. The
    ///      new internal write must not have loosened it.
    function test_bypass_updateMetadataStillRejectsNonOccupant() public {
        Slot slot = _erc20Slot();
        _seat(slot, alice, "ipfs://alice");

        vm.prank(bob);
        vm.expectRevert(MetadataModule.NotOccupant.selector);
        module.updateMetadata(address(slot), "ipfs://bob");

        assertEq(module.tokenURI(address(slot)), "ipfs://alice");
    }

    function test_version() public view {
        assertEq(module.version(), "2.1.0");
    }
}
