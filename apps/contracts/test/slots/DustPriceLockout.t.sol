// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Slot, SlotInit} from "../../src/Slot.sol";
import {SlotFactory} from "../../src/SlotFactory.sol";
import {MinimumTenureHook} from "../../src/hooks/MinimumTenureHook.sol";

contract TT is ERC20 {
    constructor() ERC20("T", "T") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// @dev C-01: a slot could be held out of forced sale for ever, for the cost of
///      gas. Enter at a price so low the tax rounds to zero — so the escrow
///      never depletes and liquidation never arms — then re-arm the tenure
///      window before it expires by releasing and rebuying through a second
///      address in one transaction. No block existed in which anyone could buy.
///
///      The fix is that the window bounds a buy rather than forbidding it: see
///      {MinimumTenureHook-BUYOUT_PREMIUM_BPS}. Protection now scales with the
///      price the occupant declared, so a dust price buys dust protection.
contract C01Test is Test {
    SlotFactory factory; TT token; MinimumTenureHook hook; Slot s;
    uint256 constant TENURE = 7 days;
    uint256 constant TAX = 1000;
    address a = makeAddr("a");   // both controlled by
    address b = makeAddr("b");   // the same attacker
    address victim = makeAddr("victim");

    function setUp() public {
        Slot impl = new Slot();
        SlotFactory fi = new SlotFactory();
        factory = SlotFactory(address(new ERC1967Proxy(address(fi),
            abi.encodeCall(SlotFactory.initialize, (address(this), address(impl))))));
        token = new TT();
        hook = new MinimumTenureHook();
        for (uint256 i; i < 3; ++i) {}
        token.mint(a, 1e24); token.mint(b, 1e24); token.mint(victim, 1e24);
        vm.warp(1_000_000);
        s = Slot(payable(factory.createSlot(SlotInit({
            recipient: address(this), currency: IERC20(address(token)),
            manager: address(0), hook: address(hook), hookData: bytes32(TENURE),
            taxBps: TAX, minDepositSeconds: 0, mutableTax: false, mutableHook: false
        }))));
    }

    function _take(address who, uint256 dep, uint256 price) internal {
        vm.startPrank(who);
        token.approve(address(s), type(uint256).max);
        s.buy(who, price, dep, 0);
        vm.stopPrank();
    }

    function test_ADustPricedOccupantCannotLockOutTheMarket() public {
        uint256 dep = hook.requiredDeposit(1, TAX, TENURE);
        emit log_named_uint("required deposit at price=1 (wei)", dep);

        _take(a, dep, 1);
        uint256 spent = dep;
        // Tracked explicitly: `vm.warp(block.timestamp + X)` in a loop reads a
        // timestamp the optimizer cached before the first warp.
        uint256 t = 1_000_000;

        // Cycle for a year, alternating the two attacker addresses.
        for (uint256 i; i < 52; ++i) {
            t += TENURE;
            vm.warp(t);
            address out = s.occupant();
            address inn = out == a ? b : a;
            vm.prank(out);
            s.release();
            _take(inn, dep, 1);
            spent += dep;
        }

        emit log_named_uint("days elapsed", (t - 1_000_000) / 1 days);
        emit log_named_uint("total attacker outlay (wei, ex-gas)", spent);
        emit log_named_uint("tax actually collected", s.collectedTax());
        emit log_named_string("slot insolvent (liquidatable)?", s.isInsolvent() ? "YES" : "NO");

        // The lockout is over the moment an honest buyer is willing to declare
        // the premium — which on a dust price is dust.
        assertEq(s.occupant() == a || s.occupant() == b, true, "fixture: attacker holds it");

        vm.startPrank(victim);
        token.approve(address(s), type(uint256).max);
        s.buy(victim, 100 ether, 100 ether, 0);
        vm.stopPrank();

        assertEq(s.occupant(), victim, "the slot must be takeable");
    }
}
