import type { LucideProps } from "lucide-react";
import { 
  Bug, 
  FileText, 
  CircleDot, 
  Flag, 
  Timer, 
  CheckCircle, 
  Circle, 
  XCircle,
  Clock
} from "lucide-react";

type Option = { 
  label: string; 
  value: string; 
  icon?: React.ComponentType<LucideProps>;
};

export const labels: Option[] = [
  { label: "Bug", value: "bug", icon: Bug },
  { label: "Feature", value: "feature", icon: CircleDot },
  { label: "Documentation", value: "documentation", icon: FileText },
  { label: "Improvement", value: "improvement", icon: Timer },
];

export const statuses: Option[] = [
  { label: "Spinning Up", value: "spinning", icon: Clock },
  { label: "Running", value: "running", icon: Circle },
  { label: "Done", value: "done", icon: CheckCircle },
  { label: "Failed", value: "failed", icon: XCircle },
  { label: "PR Opened", value: "pr_opened", icon: CircleDot },
];

export const priorities: Option[] = [
  { label: "Low", value: "low", icon: Flag },
  { label: "Medium", value: "medium", icon: Flag },
  { label: "High", value: "high", icon: Flag },
  { label: "Urgent", value: "urgent", icon: Flag },
];