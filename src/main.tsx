import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ProfileProvider } from "@/providers/profile-provider";
import { RouteProvider } from "@/providers/router-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import "@/styles/globals.css";
import { LandscapeGuard } from "@/components/layout/landscape-guard";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Activity } from "@/pages/activity";
import { Admin } from "@/pages/admin/index";
import { AuthCallback } from "@/pages/auth-callback";
import { Feed } from "@/pages/feed";
import { ForgotPassword } from "@/pages/forgot-password";
import { Landing } from "@/pages/landing";
import { NotFound } from "@/pages/not-found";
import { Onboarding } from "@/pages/onboarding";
import { PostDetail } from "@/pages/post-detail";
import { PostNew } from "@/pages/post-new";
import { ResetPassword } from "@/pages/reset-password";
import { EditProfile } from "@/pages/edit-profile";
import { Profile } from "@/pages/profile";
import { Privacy } from "@/pages/privacy";
import { AuthScreen } from "@/pages/auth";
import { Terms } from "@/pages/terms";
import { InviteOnly } from "@/pages/invite-only";
import { ENTRY_ROUTE } from "@/lib/beta";
import { isStandalone } from "@/utils/is-standalone";
import { registerServiceWorker } from "@/lib/register-sw";

registerServiceWorker();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="dark">
            {/* Outside the router: applies to every route, and nothing about it
                depends on the current one. */}
            <LandscapeGuard />
            <BrowserRouter>
                <RouteProvider>
                <ProfileProvider>
                    <Routes>
                        {/* Public. The installed PWA skips the marketing landing and opens
                            straight to Create account — or to Sign in during the closed
                            beta, where creating an account is not the way in. */}
                        <Route path="/" element={isStandalone() ? <Navigate to={ENTRY_ROUTE} replace /> : <Landing />} />
                        <Route path="/signin" element={<AuthScreen />} />
                        <Route path="/signup" element={<AuthScreen />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/post/:id" element={<PostDetail />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />
                        {/* Public on purpose: whoever lands here has just been signed out. */}
                        <Route path="/invite-only" element={<InviteOnly />} />

                        {/* Onboarding — auth required, no profile check */}
                        <Route
                            path="/onboarding"
                            element={
                                <ProtectedRoute skipProfileCheck>
                                    <Onboarding />
                                </ProtectedRoute>
                            }
                        />

                        {/* Protected — auth + profile required */}
                        <Route
                            path="/feed"
                            element={
                                <ProtectedRoute>
                                    <Feed />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/post/new"
                            element={
                                <ProtectedRoute>
                                    <PostNew />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/profile/edit"
                            element={
                                <ProtectedRoute>
                                    <EditProfile />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/profile/me"
                            element={
                                <ProtectedRoute>
                                    <Profile />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/profile/:id"
                            element={
                                <ProtectedRoute>
                                    <Profile />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/activity"
                            element={
                                <ProtectedRoute>
                                    <Activity />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin"
                            element={
                                <ProtectedRoute adminOnly>
                                    <Admin />
                                </ProtectedRoute>
                            }
                        />

                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </ProfileProvider>
                </RouteProvider>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>,
);
