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
  Archive,
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
  { label: "Backlog", value: "backlog", icon: Archive },
  { label: "Todo", value: "todo", icon: Circle },
  { label: "In Progress", value: "in progress", icon: Clock },
  { label: "Done", value: "done", icon: CheckCircle },
  { label: "Canceled", value: "canceled", icon: XCircle },
];

export const priorities: Option[] = [
  { label: "Low", value: "low", icon: Flag },
  { label: "Medium", value: "medium", icon: Flag },
  { label: "High", value: "high", icon: Flag },
  { label: "Urgent", value: "urgent", icon: Flag },
];