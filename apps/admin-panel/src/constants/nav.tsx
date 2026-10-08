import {
  CircleIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
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
      title: "Users",
      icon: <UsersIcon />,
      url: "/users",
    },
  ],
}
