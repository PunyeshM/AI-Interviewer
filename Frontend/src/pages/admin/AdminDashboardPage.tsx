import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Users, FileText, Activity, AlertCircle } from "lucide-react";
import { apiGet } from "@/lib/api";

type AdminStats = {
    total_users: number;
    total_interviews: number;
    active_sessions: number;
    system_health: string;
};

type ActivityLog = {
    type: string;
    message: string;
    timestamp: string;
};

export function AdminDashboardPage() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [statsData, activityData] = await Promise.all([
                    apiGet<AdminStats>("/api/admin/stats"),
                    apiGet<ActivityLog[]>("/api/admin/activity"),
                ]);
                setStats(statsData);
                setActivities(activityData);
            } catch (error) {
                console.error("Failed to fetch admin dashboard data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const statCards = [
        {
            title: "Total Users",
            value: stats?.total_users ?? "-",
            change: "Registered users",
            icon: Users,
            color: "text-indigo-400",
        },
        {
            title: "Total Interviews",
            value: stats?.total_interviews ?? "-",
            change: "All time",
            icon: FileText,
            color: "text-cyan-400",
        },
        {
            title: "Active Sessions (24h)",
            value: stats?.active_sessions ?? "-",
            change: "Recent interviews",
            icon: Activity,
            color: "text-emerald-400",
        },
        {
            title: "System Health",
            value: stats?.system_health ?? "-",
            change: "Operational",
            icon: AlertCircle,
            color: "text-rose-400",
        },
    ];

    if (loading) {
        return <div className="text-white">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
                <p className="text-zinc-400">Overview of system performance and user statistics.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat, index) => (
                    <Card key={index} className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{stat.value}</div>
                            <p className="text-xs text-zinc-500 mt-1">{stat.change}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-white">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    {activities.length === 0 ? (
                        <div className="text-zinc-400 text-sm">
                            No recent activity to display.
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {activities.map((activity, index) => (
                                <li key={index} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                    <span className="text-zinc-300 text-sm">{activity.message}</span>
                                    <span className="text-zinc-500 text-xs sm:ml-4">{activity.timestamp}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
