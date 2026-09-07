import { truncateAddress } from "@/utils";

const OWNER_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

const LINES = [
  { endX: 53, startX: 160, id: "line-1" },
  { endX: 160, startX: 160, id: "line-2" },
  { endX: 267, startX: 160, id: "line-3" },
  { endX: 53, startX: 160, id: "line-4" },
  { endX: 160, startX: 160, id: "line-5" },
  { endX: 267, startX: 160, id: "line-6" },
];

const SLOTS = [
  { id: "0x1a2b", filled: true },
  { id: "0x3c4d", filled: false },
  { id: "0x5e6f", filled: true },
  { id: "0x7a8b", filled: false },
  { id: "0x9c0d", filled: true },
  { id: "0xef12", filled: false },
];

export function SlotsDemo() {
  return (
    <div className="w-full lg:w-90 shrink-0 self-center">
      {/* Address */}
      <div className="rounded-lg border bg-primary text-primary-foreground px-4 py-3 text-center">
        <span className="text-[10px] uppercase tracking-wider opacity-50 block">
          Owner
        </span>
        <span className="text-xs font-bold">
          {truncateAddress(OWNER_ADDRESS)}
        </span>
      </div>
      {/* Static lines */}
      <svg
        viewBox="0 0 320 48"
        className="w-full h-12"
        preserveAspectRatio="none"
        role="img"
      >
        <title>Connections from address to slots</title>
        {LINES.map((line) => (
          <path
            key={line.id}
            d={`M${line.startX},0 C${line.startX},24 ${line.endX},24 ${line.endX},48`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.3"
          />
        ))}
      </svg>
      {/* Individual slots — flat lozenge perspective */}
      <div className="grid grid-cols-3 grid-rows-2 gap-6 py-4 px-2">
        {SLOTS.map((slot, i) => (
          <div key={slot.id} className="flex items-center justify-center">
            <div
              className={`w-20 h-20 rounded-md border flex items-center justify-center ${
                slot.filled
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground"
              }`}
              style={{ transform: "rotate(45deg) scaleY(0.6)" }}
            >
              <div
                className="flex flex-col items-center justify-center"
                style={{ transform: "scaleY(1.667) rotate(-45deg)" }}
              >
                <span className="text-[9px] uppercase tracking-wider opacity-50">
                  Slot {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[10px] font-bold mt-0.5">{slot.id}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
