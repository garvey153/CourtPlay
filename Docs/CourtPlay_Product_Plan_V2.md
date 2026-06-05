# CourtPlay — Product Plan V1

**Westport, CT | March 2026 | Confidential**

---

## Overview

| Field | Detail |
|---|---|
| Product name | CourtPlay |
| Platform | Progressive Web App (PWA) — mobile-first, web-based, add to home screen on iOS |
| Launch market | Westport, CT |
| Target user | Women 30–50, active tennis players, suburban community members |
| V1 goal | Prove the sub-finding loop with 200+ active Westport users and 50+ successful matches |
| Design system | Untitled UI (V1). Custom CourtPlay branding applied in V1.5 via token swap. |

> CourtPlay is a mobile-first web app (PWA) that replaces the chaotic WhatsApp tennis sub group in Westport, CT with a clean, fast, community-native tool. Players post sub needs, others find and claim open spots, and everyone gets back to playing tennis.

---

## 1. Problem Statement

Westport tennis players rely on a WhatsApp group to find last-minute subs. The group is popular — which proves demand — but overwhelming and inefficient. Posts get buried, skill levels aren't standardized, and coordinating payment happens offline via Venmo. There is no structured, always-available way to post a sub need and find a qualified, available player quickly.

> **The WhatsApp group is both the proof of demand and the broken solution. CourtPlay replaces it.**

### Why now

Westport's outdoor tennis season starts in April — the highest-volume period for sub requests and the moment WhatsApp group frustration peaks. The group has grown past the point of usability: post volume buries requests within minutes, and new members joining each spring make the signal-to-noise ratio worse every year. Launching ahead of the spring/summer season means CourtPlay meets players at their point of maximum pain, when they're actively looking for a better way to find subs.

| Pain point | Description |
|---|---|
| Pain point 1 | No skill-level filtering — anyone can respond regardless of fit |
| Pain point 2 | Posts get buried instantly in an active group chat |
| Pain point 3 | No claim flow — poster gets flooded with responses or none at all |
| Pain point 4 | Payment coordination happens offline, after the fact, via Venmo |
| Pain point 5 | No visibility into who has claimed, who is pending, who backed out |
| Pain point 6 | No urgency signals — a 3-day-old post looks identical to one from 3 minutes ago |

---

## 2. Solution Overview

CourtPlay is a focused, mobile-first web app with one core loop: post a sub need, browse open spots, claim a spot, get confirmed. A lightweight friend-following layer surfaces trusted connections first in the feed, with timely notifications via push and email in V1.

**One-line pitch:** *"Find a tennis sub in Westport in under 10 minutes."*

### Core loop

| Step | Description |
|---|---|
| Step 1 | Player signs up with email or Google OAuth. Sets up profile and notification preferences. |
| Step 2 | Player follows friends already on the platform. Friend posts appear first in their feed. |
| Step 3 | Player posts a sub need: format, date, time, skill level, location, cost, spots. |
| Step 4 | Available players browse the feed. Friend posts surface first within each date tier. |
| Step 5 | Player claims a spot. Post shows "Pending" to everyone. Poster notified via preferred channel. |
| Step 6 | Poster approves or rejects. After approval, both parties see contact info and Venmo handle. Pre-filled Venmo link sent. |

### What CourtPlay is not (V1)

- Not a scheduling or group management tool
- Not an in-app payment platform (V2)
- Not a social network with post visibility controls — all posts are public to all signed-in users
- Not a club or pro management tool (V1.5)
- Not a multi-sport platform (tennis only in V1)

---

## 3. Users & Roles

### 3.1 Player (primary user)

| Field | Detail |
|---|---|
| Who | Westport tennis players, primarily women 30–50. Recreational to competitive. |
| Primary actions | Post a sub need, browse feed, claim open spots, follow friends, manage notification preferences |
| Auth | Google OAuth (preferred) or email + password via Supabase Auth |
| Onboarding | Sign up → complete profile (contact info + notification prefs) → find + follow friends → land on feed. |

### 3.2 Future roles (V1.5+)

| Role | Description |
|---|---|
| Pro | Tennis professionals: post lesson and clinic openings, receive follows, manage availability. |
| Club | Tennis clubs: post court openings and events. Bulk upload in V2. |
| Advertiser | Local businesses running native sponsored feed cards. |

---

## 4. Design System — Untitled UI

CourtPlay launches using Untitled UI as its design language. Untitled UI is a production-ready React component library built on Tailwind CSS v4.2, React Aria, and TypeScript — a direct match for the CourtPlay tech stack. All branding is deferred to V1.5, when product-market fit has been established.

### 4.1 Why Untitled UI

| Reason | Detail |
|---|---|
| Stack match | Built on React 19, Tailwind CSS v4.2, and TypeScript — identical to CourtPlay's stack. |
| Speed | 5,000+ production-ready components and 250+ page templates via CLI copy-paste. |
| Token-based theming | All colors, typography, spacing, and radii defined as CSS custom properties. Rebranding means updating one token file — every component inherits the change automatically. |
| Accessibility | Built on React Aria (WAI-ARIA). Keyboard navigation and screen reader support included by default. |
| Figma parity | Untitled UI Figma kit matches React components one-to-one. Design and code stay in sync. |
| No vendor lock-in | Components copied directly into the project. You own the code. |
| Free core | MIT-licensed core, free for unlimited commercial projects. |
| Vite starter kit | Official pre-configured Vite starter kit via `npx untitledui@latest`. |

### 4.2 V1 Integration Plan

**Step 1 — Scaffold (Day 1)**
- Run `npx untitledui@latest` to initialize the Untitled UI Vite starter kit.
- Sets up Tailwind CSS v4.2 config, CSS token layer, React Aria dependencies, and base component directory in one command.

**Step 2 — Token setup (Day 1)**
- Create a single `tokens.css` file overriding Untitled UI default CSS variables with CourtPlay's V1 palette.
- V1 palette (placeholder, updated at branding phase): Primary green `#2D6A4F`, neutral grays, white background, Inter typeface.
- Token structure: `--color-primary`, `--color-primary-hover`, `--color-text-primary`, `--color-text-secondary`, `--color-background`, `--color-border`, `--radius-md`, `--radius-lg`, `--font-sans`.

**Step 3 — Component selection (ongoing)**
- Use Untitled UI CLI to copy only the components needed per screen.
- Key V1 components: Button, Input, Badge, Avatar, Card, Modal/Dialog, Toast, Toggle, Select, DatePicker, BottomNav, TopBar, EmptyState, Spinner.

**Step 4 — CourtPlay-specific components**
- SubCard, GroupCard, ClaimButton, SpotIndicator, FriendBadge, TimePressureLabel, DiscountDisplay — built using Untitled UI primitives as their base.

### 4.3 Branding Migration Plan (V1.5)

| Step | Action |
|---|---|
| Step 1 | Define CourtPlay brand: logo, wordmark, primary color, typeface, border radius, spacing scale. |
| Step 2 | Update `tokens.css` with new CSS variable values. One file, complete visual change. |
| Step 3 | Replace Inter with brand typeface via `@font-face` and `--font-sans` token update. |
| Step 4 | Review CourtPlay-specific components for any hardcoded values to tokenize. Typical review: 1–2 hours. |
| Step 5 | QA across all screens. Untitled UI's consistent token usage means most screens just work. |
| Step 6 | Update Figma token values to match if using Untitled UI Figma PRO. |

### 4.4 What Untitled UI is not responsible for

- CourtPlay's name, logo, and wordmark — applied on top of Untitled UI, not part of it.
- Brand voice, copy tone, or marketing language.
- Motion design or custom animations beyond defaults.
- The landing/marketing page — built separately using Untitled UI marketing components as a starting point.

---

## 5. V1 Feature Specification

### 5.1 Marketing Site & Onboarding

| Field | Detail |
|---|---|
| Landing page | Public-facing page at courtplay.com. Primary CTA: "Get started." Secondary: "Sign in." Built using Untitled UI marketing components. |
| Sign up flow | Google OAuth or email + password → complete profile → notification prefs → find + follow friends → feed. |
| Contact info | Email auto-populated. Phone prompted with: "Add your phone so approved subs can reach you for last-minute coordination." Optional. |
| Notification prefs | Push and/or email toggle during onboarding. Editable in settings. SMS added in V1.5. |
| Onboarding empty state | First-time users with no friends or sparse feed see a welcome card explaining how the feed works and nudging them to follow players or post their first sub need. Dismissable after first action. |
| Add to home screen | After first sign-in, inline iOS Safari prompt. Dismissable. |
| ToS + Privacy Policy | User must accept Terms of Service and Privacy Policy at sign-up. Covers data collected: email, phone, Venmo handle. Simple self-written V1 version. Linked in footer and settings. |

### 5.2 User Profile

| Field | Detail |
|---|---|
| Required fields | First name, last name initial, NTRP skill level |
| Contact fields | Email (required, auto-populated), phone (optional — for post-approval coordination and future SMS in V1.5). |
| Optional fields | Profile photo, short headline (80 char), court preferences, tennis pro preference, Venmo handle, "New to Westport" tag |
| Venmo handle | Inline note: "Only shared with approved subs to help coordinate payment. Never shown publicly." Stored encrypted. |
| Phone number | Inline note: "Only shared with approved subs to help with last-minute logistics. Never shown publicly." Stored encrypted. |
| Skill levels | NTRP 2.5–5.0. Predefined list with descriptions. |
| Court preferences | Predefined list. Multiple selections. Custom court stored on user only. |
| Friends | One-directional follow in V1. No approval required. Mutual connections in V1.5. |
| Editability | All fields editable from settings at any time. |
| Account deletion | "Delete my account" in settings. Soft delete: account deactivated, personal data anonymized, post and claim history preserved for audit trail. Irreversible with confirmation prompt. |

### 5.3 Notification Settings

| Field | Detail |
|---|---|
| V1 channels | Push (OneSignal) and Email (Resend/Postmark). Independently toggleable. |
| Default | Email on by default. Push off by default, opted in during onboarding or settings. |
| Granularity | Individual notification types toggleable per channel in settings. |
| Fallback | Email is the fallback if push is not enabled. |
| V1.5 addition | SMS via Twilio. Phone numbers collected in V1 pre-populate this setting for existing users. |

### 5.4 Friend Following

| Field | Detail |
|---|---|
| Model | One-directional following. No approval required. Friend posts surface first in feed. |
| Discovery | Search by name. Directory browseable by signed-in users. Suggested follows during onboarding. |
| Following from a post | Tap poster's name on any card to view profile and follow. |
| Feed effect | Friend posts sorted first within each date tier. One unified feed. |
| Friend badge | Posts from followed users show a subtle "Friend" pill badge. |
| Friend expiry alert | When a followed user's unfilled post is within 4 hours of game time, followers receive push + email alert. Open or Pending only. Once per post per follower. SMS added in V1.5. Alert copy: "[Name]'s spot at [Location] is still open — game starts in 4 hours." |
| Unfollow | From poster's profile. No notification sent. |
| V1.5 migration | Existing mutual one-directional follows auto-convert to mutual connections. Single-direction follows surface as "suggested mutual connections" for confirmation. |

### 5.5 The Feed

| Field | Detail |
|---|---|
| Access | Signed-in users only. Logged-out visitors see landing page only. |
| Primary CTA | "Find a Sub" — top right, green pill button. |
| Sort logic | Soonest game date first. Within each date tier: followed users' posts first, then all others by recency. |
| Cold-start behavior | When daily feed density is below 5 posts/day, disable friend-first sorting and show all posts chronologically (soonest game date first, then recency). Activate friend-first sorting layer once feed density consistently exceeds the threshold. This prevents a sparse feed from feeling emptier by burying the few posts that exist behind a friend filter with no friends to match. |
| Filters | Skill level, date range, format, location/court. Persist within session. |
| Visibility | All posts Public in V1. |
| Empty state | "No open spots right now — be the first to post one." |
| Navigation | Bottom bar: Feed, My Activity, Profile. Top bar: wordmark left, "Find a Sub" right. |
| Notify me | On Pending or full posts, tap "Notify me if this opens up" for alert on reopening. |
| Deep linking | Every post has a unique shareable URL. Logged-out users see a post preview with a prompt to sign in to claim. |
| Post sharing | Share button on every post card. Options: copy link, iMessage, WhatsApp. |
| Rate limiting | Maximum 5 active posts per user at any time. Inline message if limit is reached. |

### 5.6 Post Types

#### Post Type 1: Individual Sub Need

| Field | Detail |
|---|---|
| Purpose | Player needs one or more subs for a specific game on a specific date and time. |
| Format | Required: Point play, Clinic, Lesson, Round robin, Other event. |
| Total players | Required. Total players in the game. |
| Other fields | Date, time, skill level, location/court, pro (optional), cost (required), spots open (default 1), notes (100 char max) |
| Multiple dates | Date multi-select generates individual cards per date, linked as a series for bulk cancellation. |
| Editing | See Section 5.7 for full post editing rules. |
| Expiry | Removed from feed when game date/time passes. Stays in history. |

#### Post Type 2: Looking for a Regular Game

> **Scope note:** This post type does not contribute to the core V1 success metric (50 successful matches) because it has no claim flow. It is included in V1 because it addresses a real secondary need in the community (players looking for standing groups) and increases sign-up motivation for users who aren't yet posting sub needs. If build velocity is constrained, this is the first feature to defer to V1.5.

| Field | Detail |
|---|---|
| Purpose | Player looking to join or form a standing recurring game. No specific date. |
| Format | Multi-select: formats interested in. |
| Total players | Preferred group size (optional). |
| Other fields | Skill level, preferred days/times, preferred courts, brief note (150 char max) |
| Contact visibility | Contact info shown only to signed-in users with a complete profile (photo or headline + skill level set). |
| Editing | Freely editable at any time. |
| Expiry | 30 days or when poster removes. |

### 5.7 Post Editing Rules

The principle: once another person has committed to a post, core game details must stay stable.

**Before any claims are submitted**
- All fields editable: date, time, skill level, location, format, total players, cost, spots, notes.
- No notifications triggered.

**After a claim is pending or approved**
- Cost — editable (discount mechanic). All pending and approved claimers notified and given option to back out.
- Notes — editable. No notification triggered.
- Spots (increasing only) — allowed if no claims on the added spots.
- **Date, time, location, format, skill level — NOT editable after first claim.** Poster must cancel and repost. Cancellation flow includes reminder: "If payment has already been made via Venmo, please coordinate directly with your sub to arrange a refund."

**Series posts**
- Edits prompt: "Apply to this post only or all future posts in series?"
- Edits do not affect any occurrence that already has an approved claim.

### 5.8 Post Card Design

| Field | Detail |
|---|---|
| Sub need card | Format badge, date + day, time, skill level badge, total players, location, poster name, spots indicator (X/Y), cost, time-since-posted, view count, share button |
| Friend badge | "Friend" pill shown on cards from followed users. |
| Regular game card | Format interests, skill level, preferred days/times, courts, poster name, brief note, share button |
| Spots indicator | X/Y available. Amber at 1 remaining. Grays out when full. |
| Pending state | "Pending" badge visible to all. "Notify me if this opens up" shown. |
| Time pressure | "Game in Xh" within 24h. Green → amber (12h) → red (4h). |
| Discount display | Original price crossed out in gray, new price in green. |
| View count | Small view count on all cards. |
| Claim button | "Claim" — green pill. "Pending" awaiting approval. "Claimed" when confirmed. |
| Share button | Share icon on all cards. Opens share sheet: copy link, iMessage, WhatsApp. |
| Report button | Small "Report" option (⋯ menu) on each card. Routes to admin review queue. |

### 5.9 Discount & Urgency Mechanics

- Poster can reduce price at any time before the game.
- Prior viewers notified via preferred channel when price drops.
- All pending and approved claimers notified of price change and given option to back out.
- 48h nudge to poster if no claims: "Consider reducing the price."
- No floor on discounts. Poster may reduce to $0.

### 5.10 Claim Flow

| State | Visible to others | Actions available | Notifications |
|---|---|---|---|
| Open | Spots available. "Claim" shown. | Claimer: tap Claim. | None. |
| Pending | Pending badge. Spot count reduced. "Notify me" shown. | Claimer: unclaim. Poster: approve or reject. | Poster notified via preferred channel. |
| Approved | Spot count updates. Grays out if full. | Claimer: unclaim. Poster: cancel or reopen. Venmo link sent. | Claimer notified. Both see phone + Venmo. Venmo link pre-filled. |
| Rejected | Spot reopens. Pending badge removed. | Anyone can claim. | Claimer notified. Optional reason shown. |
| Unclaimed by claimer | Spot reopens. | Anyone can claim. | Poster notified. |
| Cancelled by poster | Post removed or reopened. | None. | All pending/approved claimers notified. Venmo refund reminder shown. |
| 12h no response | No change. | Claimer: wait or cancel. | Both nudged simultaneously via preferred channel. |
| Claimer cancels at 12h | Spot reopens. | Anyone can claim. | Poster notified. |
| Game passes — pending | Removed from feed. | None. | Non-response logged silently. |
| Game date passed | Removed from feed. | None. | None. |

**Claim rules**
- Max claims per post = number of open spots.
- One claim per user per overlapping time slot. Inline message prevents duplicates.
- Poster can respond any time up until game starts.
- Rejection reasons optional: Wrong skill level, Already filled, Other.
- Unclaiming allowed at any time in V1. Time restrictions in V1.5.

**Scenario A — Poster non-responsive**
- Claimer submits. Poster notified immediately.
- At 12h: both nudged simultaneously via preferred channel.
- Claimer chooses: wait or cancel. Poster can still approve up until game time.
- If game passes with claim unresolved, non-response logged silently in `responsiveness_log`.
- Natural consequences serve as sufficient V1 incentive: poster loses claimer, spot may go unfilled.

**Scenario B — Payment not completed (V1)**
- Platform cannot verify Venmo payment directly in V1.
- Poster has "Reopen spot" button at any time before game date.
- If reopened after approving, claimer's history records: "Spot reopened by poster after approval." Neutral, claimer's history only.
- Poster can add a private note for admin visibility only.

### 5.11 Venmo Payment Facilitation (V1 Bridge)

- After approval, poster sees pre-filled Venmo deep link: one tap opens Venmo with claimer's handle, amount, and note pre-populated.
- Claimer sees poster's Venmo handle and amount owed.
- Both see each other's phone for follow-up logistics.
- Venmo handle and phone revealed only at claim approval. Never shown publicly.

#### Known risks — V1 payment trust gap

The off-platform Venmo bridge is the single largest risk to community trust in V1. Three failure scenarios to monitor:

| Scenario | Risk | V1 mitigation |
|---|---|---|
| Claimer pays via Venmo, poster cancels | Claimer is out money with no platform recourse | Cancellation flow shows Venmo refund reminder to poster. Log in responsiveness_log for pattern detection. |
| Poster approves, claimer never pays but shows up | Poster feels platform failed to enforce the deal | "Reopen spot" button lets poster reclaim the spot. Private note field for admin visibility. |
| Claimer pays wrong amount or wrong person | Venmo handle entry error or confusion | Pre-filled Venmo deep link minimizes manual entry. Post-approval screen confirms amount and handle. |

These scenarios are tolerable at V1 scale with a tight community. **V2 in-app payments via Stripe Connect exist specifically to close this trust gap.** Track payment-related reports and reopen-after-approval events as leading indicators of when this bridge is no longer sufficient.

### 5.12 Notification System

| Trigger | Recipient | Default channel | Notes |
|---|---|---|---|
| Someone claims your spot | Poster | Push + email | Critical |
| Your claim was approved | Claimer | Push + email | Critical |
| Your claim was rejected | Claimer | Push + email | Includes optional reason |
| Your claimer backed out | Poster | Push + email | |
| Cost changed on your claimed post | Pending + approved claimers | Push + email | Includes option to back out |
| 12h nudge — claim unresponded | Poster + claimer | Push + email | Simultaneous |
| Claimer cancels pending claim | Poster | Push + email | |
| Price dropped on post you viewed | Prior viewer | Push only | Strong push opt-in lever |
| Spot reopened (Notify me) | Watcher | Per preference | |
| 48h — spot unfilled | Poster | Push only | Discount nudge |
| Game reminder (day before) | Poster + claimer | Push only | |
| Friend's unfilled spot — 4h before game | Followers | Push + email | Open/Pending only. Once per post per follower. SMS in V1.5. |
| Friend posts new sub need | Followers | Push only (opt-in) | Off by default |

**Notification channel infrastructure — V1**
- **Push notifications:** OneSignal. Free up to 10,000 subscribers. Requires app added to home screen on iOS.
- **Email:** Resend or Postmark. Transactional delivery. Auto-populated from signup. On by default for all users.
- If a user has not opted into push, email is the fallback for all notifications.

**V1.5 addition — SMS**
- SMS via Twilio added once product-market fit is confirmed. Phone numbers collected during V1 onboarding pre-populate this setting for existing users.
- Reserved for highest-urgency triggers: claim approvals, friend expiry alerts.

### 5.13 Reporting & Safety

| Field | Detail |
|---|---|
| Report a post | ⋯ menu on every post card. Options: Spam, Inappropriate content, Incorrect information, Other. One-tap submit with optional note. Reporter remains anonymous. |
| Report a user | "Report this user" option on every profile page. Same options. Routes to admin queue. |
| Admin review | Reports visible in admin dashboard. Admin can dismiss, remove content, or suspend account. |
| Repeat reporters | Users who submit multiple bad-faith reports flagged for admin review. |
| User notification | Reported user NOT notified of reports in V1. If action taken: "Your post was removed for violating community guidelines." |

### 5.14 Post History & My Activity

- "My Activity" tab: My Posts and My Claims views.
- My Posts: active, pending, claimed, completed, expired. Editable/cancellable before game date per Section 5.7.
- My Claims: pending, approved, completed, backed out.
- Completed posts stay in history. Foundation for ratings in V1.5.
- Scenario B flags visible in claimer's own history only.

### 5.15 Courts & Admin

- Predefined court list loaded at launch. Provided separately.
- Custom court name stored on post only, not added to master list.
- Admin alert: same custom court name submitted 3+ times triggers email to platform admin.

---

## 6. Admin Access

A protected admin interface accessible at `/admin` to users with `is_admin = true` in the users table. Access controlled via Supabase Row Level Security. Protected route within the app — no separate build required in V1.

### 6.1 Post Management

| Field | Detail |
|---|---|
| View all posts | Full post list including active, claimed, expired, and deleted. Filterable by status, date, user, and format. |
| Delete a post | Soft delete only — post marked deleted with timestamp and admin ID. Notifies any pending/approved claimers. |
| Edit a post | Admin can correct erroneous details. Edits logged with admin ID and timestamp. |
| Manually expire | Admin can force-expire a post before its natural game date. |
| View reports queue | All reported posts visible with reporter context and notes. |

### 6.2 User Management

| Field | Detail |
|---|---|
| View all users | Full user list with profile details, join date, post count, claim count, and report history. |
| Disable / suspend | Prevents login. User sees: "Your account has been suspended. Contact support." Reversible. |
| Delete account | Soft delete: account deactivated, personal data anonymized, history preserved. |
| View user history | Full post, claim, and report history for any user. |
| Reset password | Trigger a password reset email for any user. |
| Grant admin access | `is_admin` flag toggleable by existing admins only. |

### 6.3 Claim Management

| Field | Detail |
|---|---|
| View all claims | Full claim list, filterable by status, date, user, and post. |
| Cancel a claim | Admin can manually cancel a claim for dispute resolution. Both parties notified. |
| View responsiveness log | Full `responsiveness_log` data for any poster. Used to monitor patterns before V1.5 indicator. |

### 6.4 Court List Management

| Field | Detail |
|---|---|
| View master list | Full list of predefined courts, editable by admin. |
| Add a court | Admin adds new courts to the master list. Available to all users immediately. |
| Edit / remove | Admin can correct or retire courts. Existing posts retain their stored court name. |
| Custom court alerts | Dashboard shows pending custom court alerts. Admin reviews and decides whether to add to master list. |

### 6.5 Analytics Dashboard

| Metric | Description |
|---|---|
| Key metrics | Active users (DAU/WAU/MAU), posts created, claims made, successful matches, push opt-in rate, email open rate, D7 retention. |
| Funnel view | Sign-up → profile complete → first follow → first post or claim → first match. |
| Notification delivery | Log of notification delivery by type and channel. |
| Report activity | Count of reports submitted, actioned, and dismissed. |
| Custom court submissions | Running count of custom court names and alert status. |

---

## 7. Reference Data

### 7.1 NTRP Skill Levels

| Level | Label | Description |
|---|---|---|
| 2.5 | Beginner+ | Learning basic strokes. Still developing consistency and court awareness. |
| 3.0 | Intermediate | Able to sustain rallies. Working on directional control and serving. |
| 3.5 | Intermediate+ | Consistent on moderate pace. Starting to use spins and strategies. |
| 4.0 | Advanced Intermediate | Dependable strokes under pressure. Good court coverage and strategy. |
| 4.5 | Advanced | Strong all-around game. Executes shots with pace, spin, and placement. |
| 5.0 | Expert | Tournament-level play. Dominant strokes, tactical, consistent under pressure. |

### 7.2 Play Formats

| Format | Description |
|---|---|
| Point play | Fun, fast-paced competitive games led by a pro. |
| Clinic | Structured group drill session, typically led by a pro. |
| Lesson | Instructional session with a pro. Semi-private (2–4 players) or private. |
| Round robin | Rotating partners format. Typically 6–12 players, organized play. |
| Other event | Any format not listed. Poster adds a brief description in notes. |

### 7.3 Courts

Predefined list of Westport-area courts to be provided separately. Custom court entry available on all forms. Admin notified when a custom name is submitted 3+ times.

---

## 8. Technical Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript v5.9 + Vite. Mobile-first, 390px base. Tailwind CSS v4.2. |
| Design system | Untitled UI React. Initialized via `npx untitledui@latest` (Vite starter). Components in `/src/components/ui/`. Token overrides in `tokens.css`. |
| PWA | manifest.json + service worker for iOS home screen install. Push via OneSignal. |
| Backend + database | Supabase — auth, PostgreSQL, real-time, file storage. Row Level Security for admin route protection. |
| Authentication | Supabase Auth: Google OAuth and email/password. |
| Push notifications | OneSignal. Free tier up to 10,000 subscribers. |
| Email | Resend or Postmark. Transactional, on by default. |
| SMS (V1.5) | Twilio. Added post product-market fit. Phone numbers collected in V1 require no re-onboarding. |
| Build approach | Lovable or Bolt for initial scaffolding with Untitled UI Vite starter. Claude Code for custom logic. |
| Payments (V2) | Stripe Connect. Not in V1 scope. |
| Hosting | Vercel or Netlify. Custom domain: courtplay.com. |
| Analytics | PostHog or Mixpanel (free tier). |

### Data model

| Table | Key fields |
|---|---|
| `posts` | id, author_id, post_type, format, total_players, date, time, skill_level, location, court_id, custom_court, pro_id, cost, original_cost, spots_total, series_id, status, deleted_at, deleted_by, view_count, expires_at, author_type |
| `claims` | id, post_id, claimer_id, status, rejection_reason, reopen_note, created_at, resolved_at |
| `users` | id, email, first_name, last_name_initial, headline, photo_url, skill_level, court_preferences, venmo_handle (encrypted), phone (encrypted), new_to_westport, is_admin, is_suspended, deleted_at |
| `notification_preferences` | id, user_id, notification_type, push_enabled, email_enabled, sms_enabled (false in V1) |
| `follows` | id, follower_id, following_id, created_at — one-directional in V1 |
| `notifications` | id, user_id, type, post_id, claim_id, channel, read, created_at |
| `notify_me` | id, user_id, post_id, created_at |
| `reports` | id, reporter_id, target_type, target_id, reason, note, status, reviewed_by, reviewed_at |
| `responsiveness_log` | id, poster_id, post_id, claim_id, event_type, response_time_hours — silent in V1 |
| `custom_court_submissions` | id, court_name, submission_count, last_submitted_at, alerted |

**Feed sort:** `ORDER BY game_date ASC, (follower_id IS NOT NULL) DESC, created_at DESC`

**Friend expiry alert job:** Scheduled hourly task. Finds unfilled posts within 4h of game time, checks follows table, sends push + email via each follower's preferences. Deduplicated — once per post per follower.

---

## 9. Monetization Roadmap

> V1 is entirely free. No monetization until the core loop is validated with 200+ active users and 50+ successful matches.

| Version | Feature | Model | Timing |
|---|---|---|---|
| V1 | Post, browse, claim, friend feed, Venmo bridge, push + email, admin | Free | Launch |
| V1.5 | CourtPlay brand token swap | Design investment, no cost to users | Post product-market fit |
| V1.5 | SMS notifications via Twilio | Free feature, cost absorbed | Post product-market fit |
| V1.5 | Pro + club featured listings | Flat monthly fee ($75–$150/mo) | 200+ users |
| V1.5 | Mutual friends + FoF visibility controls | Free — building the asset | 200+ users |
| V2 | In-app peer-to-peer payments | 5% convenience fee, claimer pays | 500+ users |
| V2 | Connected tier — expanded reach | Subscription ($8–10/mo) | Social graph adopted |
| V3 | Bulk upload, native ads, geo expansion | B2B tiers + ad revenue | Multi-market |

---

## 10. Future Scope — V1.5 & V2

### V1.5 — Grow the network

- **CourtPlay brand identity:** Apply custom brand tokens to `tokens.css`. All Untitled UI components inherit the change automatically. No component rewrites.
- **SMS notifications:** Twilio integration using phone numbers already on file from V1.
- **Mutual friend requests + block:** Upgrade one-directional follows to mutual connections. Existing mutual follows auto-convert; single-direction follows surface as suggestions.
- **Friends/FoF expanded reach:** FoF post visibility and priority placement infrastructure. Free at this stage — building the asset for Connected tier monetization in V2.
- **Responsiveness indicator:** Surface poster response history using `responsiveness_log` data from V1.
- **Pro profiles:** Post openings, receive follows, push notifications to followers.
- **Club profiles:** Post court openings. Featured feed placement.
- **Series takeover post type:** Full recurring series handoff. Direct contact, no in-app claim.
- **Group formation:** Group profiles, member management, recurring scheduling.
- **Light ratings:** Post-game reliability prompt. Data collection only.

### V2 — Monetize & expand

- **In-app payments:** Stripe Connect. 5% fee paid by claimer.
- **Connected tier:** $8–10/mo unlocks expanded reach — priority feed placement, Friends-of-Friends visibility, and boosted post distribution. All posts remain public by default; the Connected tier adds reach, it does not restrict what's currently free.
- **Native iOS app:** Convert PWA to native. App Store distribution.
- **Geographic expansion:** Greenwich, Darien, Wilton.
- **Activity petition:** Propose new activity, gather 200 signatures, unlock the category.

### V3 — Scale

- **Bulk upload:** Spreadsheet or calendar sync for clubs and pros.
- **Native advertising:** Sponsored native feed cards.
- **The Sub Stack:** Expand to pickleball, mahjong, golf across affluent suburbs.
- **Hive platform:** CourtPlay graduates into the broader community-building platform.

---

## 11. Go-to-Market — Westport Launch

| Field | Detail |
|---|---|
| Target market | Westport, CT. HHI $150k+, active women 30–50, established tennis culture, strong word-of-mouth dynamics. |
| V1 launch goal | 200+ active users, 50+ successful sub matches in first 60 days. |
| Phase 1: Invite-only cohort | Hand-picked users across tennis, school, and neighborhood networks. Unlimited invite codes. Build friend graph, work out kinks before broader exposure. |
| Phase 2: WhatsApp drop | Post in the existing Westport tennis WhatsApp group once kinks are resolved. Highest-leverage single moment. Post as founder, not as ad. |
| Phase 3: Explicit launch | Westport Facebook groups, Nextdoor, 06880 blog, local press, founder's Instagram. Real success stories are the marketing. |
| Waitlist | Public from day one. Move up 10 spots per referral. Drip open 30–50/week during invite-only phase. |
| Expansion signal | Waitlist signups from Greenwich or Darien trigger expansion playbook. |
| Budget | Landing page ($500–1,500), founding member gifts ($1,000–2,000), local PR ($1,500–3,000), founder event ($2,000–4,000). Hold paid social until Phase 3. |

---

## 12. Success Metrics — V1

> The Westport tennis WhatsApp group has approximately [X] active members. V1 targets are calibrated against this known universe.

| Metric | Target | Timeframe |
|---|---|---|
| Signed-up users | 200+ | 60 days post-launch |
| Posts created | 100+ | 60 days post-launch |
| Successful matches (approved claims) | 50+ | 60 days post-launch |
| Median time-to-fill (post to approved claim) | Under 10 minutes | Ongoing (core pitch metric) |
| Poster-to-claimer ratio | Track — no target in V1 | Ongoing (supply vs. demand diagnostic) |
| Push notification opt-in rate | 40%+ | Ongoing |
| Notification-to-action conversion rate (all types) | Track — no target in V1 | Ongoing |
| Email open rate (transactional) | 50%+ | Ongoing |
| D7 retention | 30%+ | Ongoing |
| Claim-to-approval rate | 70%+ | Ongoing |
| Unclaim / reopen rate | Under 15% | Ongoing |
| Venmo link tap-through rate | 60%+ | Ongoing |
| Friend follows per user (avg) | 3+ | 60 days post-launch |
| Friend expiry alert → claim conversion | 20%+ | Ongoing |
| Post share tap rate | 10%+ | Ongoing (virality signal) |
| Deep link sign-up conversion | 15%+ | Ongoing (growth signal) |
| Organic referrals (signed up via invite) | 50%+ | 60 days post-launch |

---

*CourtPlay | Product Plan V1 | Westport, CT | March 2026 | Confidential*
