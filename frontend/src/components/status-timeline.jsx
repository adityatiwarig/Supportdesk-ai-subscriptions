const STEPS = [
  { key: "created", label: "Created", icon: "1" },
  { key: "todo", label: "Queued", icon: "2" },
  { key: "ai", label: "AI Analysis", icon: "3" },
  { key: "in_progress", label: "In Progress", icon: "4" },
  { key: "done", label: "Resolved", icon: "5" },
];

function getStepIndex(status) {
  if (!status) return 0;
  const s = status.toLowerCase().replace(/[_\s-]/g, "");
  if (s === "todo") return 1;
  if (s === "inprogress" || s === "pending") return 3;
  if (s === "done" || s === "closed" || s === "resolved") return 4;
  return 0;
}

export default function StatusTimeline({ status, assignedTo }) {
  let activeIdx = getStepIndex(status);
  if (activeIdx >= 1 && assignedTo) {
    activeIdx = Math.max(activeIdx, 3);
  }
  if (activeIdx === 1) {
    activeIdx = 2;
  }

  return (
    <div className="w-full py-4">
      <ul className="steps steps-horizontal w-full text-xs">
        {STEPS.map((step, idx) => (
          <li
            key={step.key}
            className={`step ${idx <= activeIdx ? "step-primary" : ""}`}
            data-content={idx < activeIdx ? "ok" : idx === activeIdx ? step.icon : ""}
          >
            <span className={idx <= activeIdx ? "font-medium" : "opacity-50"}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
