import {
  ArrowLeftRightIcon,
  CircleIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  ScrollTextIcon,
  UsersIcon,
} from "lucide-react"

export const nav = {
  teams: [
    {
      name: "PAYLEDGER",
      logo: <CircleIcon className="size-4" />,
      plan: "",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      icon: <LayoutDashboardIcon />,
      url: "/",
    },
    {
      title: "Withdrawals",
      icon: <LandmarkIcon />,
      url: "/withdrawals",
    },
    {
      title: "Transactions",
      icon: <ReceiptIcon />,
      url: "/transactions",
    },
    {
      title: "Transfers",
      icon: <ArrowLeftRightIcon />,
      url: "/transfers",
    },
    {
      title: "Payments",
      icon: <LandmarkIcon />,
      url: "/payments",
    },
    {
      title: "Users",
      icon: <UsersIcon />,
      url: "/users",
    },
    {
      title: "Audit Logs",
      icon: <ScrollTextIcon />,
      url: "/audit-logs",
    },
  ],
}
