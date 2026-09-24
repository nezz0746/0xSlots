// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibString} from "solady/utils/LibString.sol";

/**
 * @title ModuleSchemaLib
 * @notice Builds the JSON document a module answers `definition()` with.
 *
 * @dev ── Why a module writes JSON at all ──────────────────────────────────
 *
 *      So that an application can render a configuration form for a module
 *      nobody wrote a UI for, by reading the chain and nothing else. JSON
 *      Schema is the format with libraries behind it — `react-jsonschema-form`,
 *      JSONForms, AJV — so `definition().settings` is handed to one of those
 *      untouched, and the work is already done.
 *
 *      Built here rather than stored as a literal because the BOUNDS are the
 *      module's own constants. A schema published off-chain, or baked in as
 *      text, drifts to saying thirty days while the code still refuses
 *      anything over a year, and the form is right up until the transaction
 *      reverts. Interpolated from `MAX_TENURE`, it cannot.
 *
 *      ── Every value is a string ─────────────────────────────────────────
 *
 *      JSON numbers are IEEE-754 doubles in every JavaScript parser, and a
 *      `uint64` maximum is 1.8e19 — `JSON.parse` rounds it silently, which is
 *      the same class of error the bounds exist to prevent. So each value is
 *      a string with a `pattern`, and its range travels as `x-minimum` /
 *      `x-maximum` strings beside it.
 *
 *      The cost is that AJV cannot range-check a string, which is the right
 *      trade here: the bounds were always advice, and `checkSettings` on
 *      the chain is the authority. A form shows the hint; the module gives the
 *      verdict.
 *
 *      ── The conventions, and there are only three ───────────────────────
 *
 *      `x-abi` is an ORDERED list of `{name, type}` — viem's own
 *      `AbiParameter[]`, so a client encodes with one call. Ordered because
 *      ABI encoding is positional and `properties` is a JSON object, which is
 *      not. `abi.encode` of those values, in that order, IS the slot's
 *      `settings`.
 *
 *      `x-optional` says the whole configuration may be left out, which is a
 *      real slot and not an unconfigured one.
 *
 *      `x-semantic` tags a field with a behaviour a client may recognise —
 *      `"minimum-tenure"` — so a module can say "this slot protects its
 *      occupant for 7 days" without knowing which module is enforcing it.
 */
library ModuleSchemaLib {
    using LibString for string;
    using LibString for uint256;

    /// @notice One configurable value: what it is, what it means, what it may be.
    struct Field {
        /// The property name, and the `x-abi` name. Same in both, so a client
        /// pairs them without guessing.
        string name;
        /// The ABI type it encodes as — `uint64`, `bytes32`, `address`.
        string abiType;
        /// What to call it on a form.
        string title;
        /// One line of help. May be empty.
        string description;
        /// `x-unit`. May be empty.
        string unit;
        /// Decimal strings. Empty means unbounded in that direction.
        string min;
        string max;
        /// `x-enum-labels`, in value order. Empty means not an enumeration.
        string[] enumLabels;
        /// `x-semantic`. May be empty.
        string semantic;
    }

    // ─── declaring a value ──────────────────────────────────────────────────
    //
    // One call per value, and the type of call says what kind of control a
    // client should draw. Everything optional is a modifier after it, so a
    // module declaring three values writes three lines rather than three struct
    // literals full of empty strings.

    /// @notice A number, bounded by the module's own constants.
    /// @param unit What the number counts — `"seconds"`. May be empty.
    function number(
        string memory name,
        string memory abiType,
        string memory title,
        string memory unit,
        uint256 min,
        uint256 max
    ) internal pure returns (Field memory f) {
        f.name = name;
        f.abiType = abiType;
        f.title = title;
        f.unit = unit;
        f.min = min.toString();
        f.max = max.toString();
    }

    /// @notice One of a fixed set, labelled in value order.
    function choice(
        string memory name,
        string memory abiType,
        string memory title,
        string[] memory options
    ) internal pure returns (Field memory f) {
        f.name = name;
        f.abiType = abiType;
        f.title = title;
        f.enumLabels = options;
        f.min = "0";
        f.max = (options.length == 0 ? 0 : options.length - 1).toString();
    }

    /// @notice Anything a range does not describe — an address, a hash, a name.
    function value(
        string memory name,
        string memory abiType,
        string memory title
    ) internal pure returns (Field memory f) {
        f.name = name;
        f.abiType = abiType;
        f.title = title;
    }

    // ─── modifiers ──────────────────────────────────────────────────────────
    //
    // Each returns the field, so they chain onto a declaration.

    /// @notice One line of help, under the control.
    function explain(
        Field memory f,
        string memory description
    ) internal pure returns (Field memory) {
        f.description = description;
        return f;
    }

    /// @notice Tag a behaviour a client may recognise — `"minimum-tenure"`.
    /// @dev How an application finds a value it understands in a module it does
    ///      not, whatever that module chose to call the field.
    function means(
        Field memory f,
        string memory semantic
    ) internal pure returns (Field memory) {
        f.semantic = semantic;
        return f;
    }

    /// @notice Move the floor — a rule that is required on one host and
    ///         optional on another shares everything but this.
    function from(Field memory f, uint256 min) internal pure returns (Field memory) {
        f.min = min.toString();
        return f;
    }

    /// @notice Labels for a {choice}, in value order.
    /// @dev Solidity has no literal for a `string[] memory`, and writing one out
    ///      costs four lines that say nothing.
    function labels(
        string memory a,
        string memory b
    ) internal pure returns (string[] memory out) {
        out = new string[](2);
        out[0] = a;
        out[1] = b;
    }

    function labels(
        string memory a,
        string memory b,
        string memory c
    ) internal pure returns (string[] memory out) {
        out = new string[](3);
        out[0] = a;
        out[1] = b;
        out[2] = c;
    }

    function labels(
        string memory a,
        string memory b,
        string memory c,
        string memory d
    ) internal pure returns (string[] memory out) {
        out = new string[](4);
        out[0] = a;
        out[1] = b;
        out[2] = c;
        out[3] = d;
    }

    // ─── collecting them ────────────────────────────────────────────────────
    //
    // In ENCODING order, which is the order `x-abi` publishes and the order
    // `abi.encode` expects.

    function list(Field memory a) internal pure returns (Field[] memory out) {
        out = new Field[](1);
        out[0] = a;
    }

    function list(
        Field memory a,
        Field memory b
    ) internal pure returns (Field[] memory out) {
        out = new Field[](2);
        out[0] = a;
        out[1] = b;
    }

    function list(
        Field memory a,
        Field memory b,
        Field memory c
    ) internal pure returns (Field[] memory out) {
        out = new Field[](3);
        out[0] = a;
        out[1] = b;
        out[2] = c;
    }

    // ─── the document ───────────────────────────────────────────────────────

    /**
     * @notice Everything a module answers `definition()` with, in one call.
     *
     * @param title What the module is called.
     * @param description One line about what it does.
     * @param docs Where the human documentation lives. May be empty.
     * @param fields The configuration, in encoding order. Empty for a module that
     *        takes none, which publishes no schema at all.
     * @param optional Whether a slot may attach this module configuring nothing.
     */
    function describe(
        string memory title,
        string memory description,
        string memory docs,
        Field[] memory fields,
        bool optional
    ) internal pure returns (string memory) {
        return
            string.concat(
                '{"version":1',
                ',"title":', title.escapeJSON(true),
                ',"description":', description.escapeJSON(true),
                bytes(docs).length == 0 ? "" : string.concat(',"docs":', docs.escapeJSON(true)),
                fields.length == 0
                    ? ""
                    : string.concat(
                        ',"settings":',
                        _configSchema(title, fields, optional)
                    ),
                "}"
            );
    }

    /// @notice A module that takes no configuration at all.
    function describe(
        string memory title,
        string memory description,
        string memory docs
    ) internal pure returns (string memory) {
        return describe(title, description, docs, new Field[](0), false);
    }

    // ─── internals ──────────────────────────────────────────────────────────

    /**
     * @dev The configuration half: a JSON Schema, plus `x-abi`.
     *
     *      `x-abi` is built from the same array as `properties`, so the two
     *      cannot disagree about which value goes where.
     */
    function _configSchema(
        string memory title,
        Field[] memory fields,
        bool optional
    ) private pure returns (string memory out) {
        out = string.concat(
            '{"$schema":"https://json-schema.org/draft/2020-12/schema"',
            ',"title":', title.escapeJSON(true),
            ',"type":"object"'
        );
        if (optional) out = string.concat(out, ',"x-optional":true');

        out = string.concat(out, ',"properties":{');
        for (uint256 i; i < fields.length; ++i) {
            out = string.concat(out, i == 0 ? "" : ",", _property(fields[i]));
        }

        out = string.concat(out, '},"required":[');
        for (uint256 i; i < fields.length; ++i) {
            out = string.concat(out, i == 0 ? "" : ",", fields[i].name.escapeJSON(true));
        }

        out = string.concat(out, '],"additionalProperties":false,"x-abi":[');
        for (uint256 i; i < fields.length; ++i) {
            out = string.concat(
                out,
                i == 0 ? "" : ",",
                '{"name":', fields[i].name.escapeJSON(true),
                ',"type":', fields[i].abiType.escapeJSON(true), "}"
            );
        }
        out = string.concat(out, "]}");
    }

    function _property(Field memory f) private pure returns (string memory out) {
        out = string.concat(
            f.name.escapeJSON(true), ':{"type":"string"',
            ',"pattern":"', _pattern(f.abiType), '"',
            ',"title":', f.title.escapeJSON(true)
        );
        if (bytes(f.description).length != 0)
            out = string.concat(out, ',"description":', f.description.escapeJSON(true));
        if (bytes(f.unit).length != 0)
            out = string.concat(out, ',"x-unit":', f.unit.escapeJSON(true));
        if (bytes(f.min).length != 0)
            out = string.concat(out, ',"x-minimum":', f.min.escapeJSON(true));
        if (bytes(f.max).length != 0)
            out = string.concat(out, ',"x-maximum":', f.max.escapeJSON(true));
        if (bytes(f.semantic).length != 0)
            out = string.concat(out, ',"x-semantic":', f.semantic.escapeJSON(true));
        if (f.enumLabels.length != 0) {
            out = string.concat(out, ',"x-enum-labels":[');
            for (uint256 i; i < f.enumLabels.length; ++i) {
                out = string.concat(out, i == 0 ? "" : ",", f.enumLabels[i].escapeJSON(true));
            }
            out = string.concat(out, "]");
        }
        out = string.concat(out, "}");
    }

    /**
     * @dev What a value of this type must look like as text.
     *
     *      The pattern is what a generic validator CAN enforce once every
     *      value is a string: shape, not range. A type nothing is known about
     *      gets no pattern rather than a wrong one.
     */
    function _pattern(string memory abiType) private pure returns (string memory) {
        if (abiType.startsWith("uint") || abiType.startsWith("int")) return "^[0-9]+$";
        if (abiType.eq("address")) return "^0x[0-9a-fA-F]{40}$";
        if (abiType.eq("bytes32")) return "^0x[0-9a-fA-F]{64}$";
        if (abiType.eq("bool")) return "^(true|false)$";
        return ".*";
    }
}
