import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./components/toast.jsx";
import CheckAuth from "./components/check-auth.jsx";
import Layout from "./components/layout.jsx";
import Tickets from "./pages/tickets.jsx";
import TicketDetailsPage from "./pages/ticket.jsx";
import Login from "./pages/login.jsx";
import Signup from "./pages/signup.jsx";
import Admin from "./pages/admin.jsx";
import AssignedWorkPage from "./pages/assigned-work.jsx";
import ResetPasswordPage from "./pages/reset-password.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route
              path="/"
              element={
                <CheckAuth protected={true}>
                  <Tickets />
                </CheckAuth>
              }
            />
            <Route
              path="/tickets/:id"
              element={
                <CheckAuth protected={true}>
                  <TicketDetailsPage />
                </CheckAuth>
              }
            />
            <Route
              path="/assigned-work"
              element={
                <CheckAuth protected={true}>
                  <AssignedWorkPage />
                </CheckAuth>
              }
            />
            <Route
              path="/login"
              element={
                <CheckAuth protected={false}>
                  <Login />
                </CheckAuth>
              }
            />
            <Route
              path="/signup"
              element={
                <CheckAuth protected={false}>
                  <Signup />
                </CheckAuth>
              }
            />
            <Route
              path="/reset-password/:token"
              element={
                <CheckAuth protected={false}>
                  <ResetPasswordPage />
                </CheckAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <CheckAuth protected={true}>
                  <Admin />
                </CheckAuth>
              }
            />
          </Routes>
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
