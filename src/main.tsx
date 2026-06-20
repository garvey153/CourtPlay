import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { ProfileProvider } from "@/providers/profile-provider";
import { RouteProvider } from "@/providers/router-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import "@/styles/globals.css";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Activity } from "@/pages/activity";
import { Admin } from "@/pages/admin/index";
import { AuthCallback } from "@/pages/auth-callback";
import { Feed } from "@/pages/feed";
import { Landing } from "@/pages/landing";
import { NotFound } from "@/pages/not-found";
import { Onboarding } from "@/pages/onboarding";
import { PostDetail } from "@/pages/post-detail";
import { PostNew } from "@/pages/post-new";
import { Profile } from "@/pages/profile";
import { Settings } from "@/pages/settings";
import { Privacy } from "@/pages/privacy";
import { SignIn } from "@/pages/sign-in";
import { SignUp } from "@/pages/sign-up";
import { Terms } from "@/pages/terms";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="dark">
            <BrowserRouter>
                <RouteProvider>
                <ProfileProvider>
                    <Routes>
                        {/* Public */}
                        <Route path="/" element={<Landing />} />
                        <Route path="/signin" element={<SignIn />} />
                        <Route path="/signup" element={<SignUp />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/post/:id" element={<PostDetail />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />

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
                            path="/settings"
                            element={
                                <ProtectedRoute>
                                    <Settings />
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
