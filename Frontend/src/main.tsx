import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import "./styles/index.css";
import { AuthProvider } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProfilePage } from "./pages/ProfilePage";
import { InterviewPage } from "./pages/InterviewPage";
import { ResultsPage } from "./pages/ResultsPage";
import { CodingDashboardPage } from "./pages/CodingDashboardPage";
import { CommunityDashboardPage } from "./pages/CommunityDashboardPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage";
import AdminLayout from "./layouts/AdminLayout";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { UsersListPage } from "./pages/admin/UsersListPage";
import { UserDetailsPage } from "./pages/admin/UserDetailsPage";
import { InterviewsListPage } from "./pages/admin/InterviewsListPage";
import { InterviewDetailsPage } from "./pages/admin/InterviewDetailsPage";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="/results/:interviewId" element={<ResultsPage />} />
        <Route path="/coding" element={<CodingDashboardPage />} />
        <Route path="/community" element={<CommunityDashboardPage />} />
        <Route path="/dashboard" element={<StudentDashboardPage />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<UsersListPage />} />
          <Route path="users/:userId" element={<UserDetailsPage />} />
          <Route path="interviews" element={<InterviewsListPage />} />
          <Route path="interviews/:interviewId" element={<InterviewDetailsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  </BrowserRouter>,
);