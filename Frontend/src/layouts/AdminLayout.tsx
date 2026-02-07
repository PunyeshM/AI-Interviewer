import { Outlet, Link } from "react-router-dom";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/app/components/ui/navigation-menu";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminLayout() {
  const { setState } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    setState({
      user: null,
      accessToken: null,
      resumeSummary: null,
      skills: [],
    });
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-indigo-500/30">
      {/* Navbar */}
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/admin" className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              InterViewDost Admin
            </Link>

            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} bg-transparent text-zinc-400 hover:text-white hover:bg-white/5`}>
                    <Link to="/admin">
                      Dashboard
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} bg-transparent text-zinc-400 hover:text-white hover:bg-white/5`}>
                    <Link to="/admin/users">
                      Users
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} bg-transparent text-zinc-400 hover:text-white hover:bg-white/5`}>
                    <Link to="/admin/interviews">
                      Interviews
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-zinc-400 hover:text-white hover:bg-white/5"
              onClick={handleLogout}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 px-6 container mx-auto pb-12">
        <Outlet />
      </main>
    </div>
  );
}
