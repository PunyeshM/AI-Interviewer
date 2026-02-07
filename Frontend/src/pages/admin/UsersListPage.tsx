import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Search, Eye } from "lucide-react";
import { apiGet } from "@/lib/api";

type UserSummary = {
    user_id: number;
    name: string | null;
    email: string | null;
    role: string | null;
};

export function UsersListPage() {
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        async function fetchUsers() {
            try {
                const data = await apiGet<UserSummary[]>("/api/admin/users");
                setUsers(data);
            } catch (error) {
                console.error("Failed to fetch users:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchUsers();
    }, []);

    const filteredUsers = users.filter((user) =>
        (user.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (user.email?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Users</h1>
                    <p className="text-zinc-400">Manage and view all registered users.</p>
                </div>
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Search users..."
                        className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-zinc-400">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400">No users found.</div>
                ) : (
                    <Table>
                        <TableHeader className="bg-zinc-900">
                            <TableRow className="border-zinc-800 hover:bg-zinc-900">
                                <TableHead className="text-zinc-400 font-medium">ID</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Name</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Email</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Role</TableHead>
                                <TableHead className="text-right text-zinc-400 font-medium">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.user_id} className="border-zinc-800 hover:bg-zinc-800/50">
                                    <TableCell className="text-zinc-300 font-mono text-xs">{user.user_id}</TableCell>
                                    <TableCell className="text-white font-medium">{user.name || "N/A"}</TableCell>
                                    <TableCell className="text-zinc-300">{user.email}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium 
                      ${user.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-700/50 text-zinc-300'}`}>
                                            {user.role}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link to={`/admin/users/${user.user_id}`}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}
