WorkSync - Employee Time & Roster Management App - Requirements Document
1. Project Overview
Objective: Build a mobile application for efficient employee shift management and time tracking, using:

Frontend: React Native (Expo)

Backend & Auth: Supabase

Server Logic: Node.js (for background jobs & complex operations)

APIs: Expo Location & TaskManager, Push Notifications

Key Differentiators:

Geo-fenced clock-in/out with location verification.

Proactive shift management with availability submission and handover alerts.

Real-time admin dashboard for live attendance monitoring.

2. Functional Requirements
2.1 Authentication & User Management (Supabase)
User Signup: Email/password validation. Role selection (Employee/Admin) upon signup (with admin approval flow if needed).

User Login: Secure login with Supabase Auth. "Remember Me" functionality using persisted auth session.

Password Reset: "Forgot Password" flow sending reset links via email.

Profile Management: Users can view and edit basic profile information.

2.2 Core Time Tracking
Clock In/Out:

Primary button on employee dashboard toggles state.

Captures precise timestamp and device location (lat/long).

Validates against active shift assignment.

Break Management:

"Start Break"/"End Break" buttons available only when clocked in.

Tracks break duration.

Geo-fencing:

On clock-in/out, fetches device location.

Validates if location is within a pre-defined site radius (configurable by admin).

Stores location coordinates and accuracy radius for audit trail.

Current Status Display: Clear visual indicator on dashboard (e.g., "Clocked In", "On Break", "Clocked Out").

2.3 Shifts & Scheduling
Employee Availability:

Form to submit available times (date, start/end time, recurring weekly option).

Admin Availability Board:

Visual grid/heatmap view showing employee availability for easy scheduling.

Shift Creation & Management (Admin):

Create shifts (single or repeating) with date, time, assigned employee, and site location.

Publish shifts to make them visible to employees.

Edit, cancel, or reassign shifts.

Shift Views (Employee):

List view of assigned shifts.

Calendar view for a broader overview.

Shift Acceptance (Optional):

Employees can Accept/Decline newly assigned shifts (configurable by admin).

2.4 Notifications & Alerts (Expo Notifications)
Employee Notifications:

Shift reminder (e.g., 30 minutes before start).

"Handover Alert" notifying who is working the next shift.

Alert for any shift changes/cancellations.

Admin Notifications:

Real-time push alert when an employee clocks in/out.

Missed clock-in alert (triggered X minutes after a shift start time).

Notification when a shift is declined (if using acceptance flow).

2.5 Dashboards & Reporting
Employee Dashboard:

Main View: Current status, quick actions (Clock In/Out, Break), next shift.

Timesheet: Personal view of hours worked (daily, weekly, monthly).

Shift Calendar: Integrated calendar view.

History: Log of all past clock events.

Admin Dashboard:

Live View: Real-time list of who is currently clocked in/out.

Punch Log: Searchable log of all clock events with geolocation data on a map.

Punch Adjustment: Interface to approve or manually adjust missed/incorrect punches.

Reporting: Generate reports on hours worked, overtime, absenteeism, and late arrivals.

Export: Ability to export reports to CSV/PDF.

3. Technical Specifications
3.1 Supabase Schema
profiles (extends Supabase auth.users): id (uuid, FK), role (text), full_name (text)

sites: id (uuid), name (text), address (text), geo_fence_radius (int), latitude (float), longitude (float)

shifts: id (uuid), site_id (uuid, FK), employee_id (uuid, FK), start_time (timestamptz), end_time (timestamptz), status (text)

availability: id (uuid), employee_id (uuid, FK), start_time (timestamptz), end_time (timestamptz), is_recurring (boolean)

time_punches: id (uuid), employee_id (uuid, FK), shift_id (uuid, FK), type (text: 'in', 'out', 'break_start', 'break_end'), timestamp (timestamptz), latitude (float), longitude (float), accuracy (float)

notifications: id (uuid), user_id (uuid, FK), title (text), body (text), data (jsonb), read (boolean)

3.2 API Integration & Server Logic (Node.js)
Expo Location API: For fetching and validating device coordinates.

Expo Notifications: For sending push alerts.

Expo Background Fetch/TaskManager: For triggering shift reminder checks.

Node.js Server (e.g., Supabase Edge Functions or separate server):

Cron jobs to send scheduled notifications (shift reminders, handover alerts).

Cron job to check for missed clock-ins and trigger alerts.

Handles complex reporting generation.

3.3 Component Architecture
AuthStack: Login, Signup, Forgot Password screens.

EmployeeTabNavigator:

DashboardScreen

ScheduleScreen

TimesheetScreen

ProfileScreen

AdminTabNavigator:

AdminDashboardScreen

RosterManagerScreen

ReportsScreen

ProfileScreen

Shared Components:

PunchButton

ShiftCard

NotificationCenter

4. Non-Functional Requirements
Performance: Core actions (clock in/out) should complete in <2s. Dashboards load in <3s.

Security:

Row Level Security (RLS) enabled on all Supabase tables.

API keys and secrets stored securely in environment variables.

Location data is hashed/verified to prevent spoofing.

Reliability: The app must handle poor network connectivity gracefully (queue actions for when online).

Usability: Intuitive UI with clear distinctions between Employee and Admin flows.

5. Development Milestones
Phase 1: Foundation (4 days)

Supabase setup & Auth flow (Login, Signup, Remember Me).

Basic user profiles and roles.

Phase 2: Core Time Tracking (4 days)

Clock In/Out/Break functionality.

Location capture and geo-fencing.

Basic employee timesheet view.

Phase 3: Shift Management (5 days)

Availability submission.

Admin shift creation & assignment.

Employee shift views.

Phase 4: Notifications & Reporting (4 days)

Implement push notifications.

Build Admin Dashboard with live view and reports.

Create report export functionality.

Phase 5: Polish & Testing (3 days)

Error handling, offline capabilities, and bug fixes.

6. Risk Management
Risk: Location spoofing by employees.

Mitigation: Use a combination of GPS, network location, and store accuracy radius. For high-security sites, consider on-site QR code check-in as a supplement.

Risk: Node.js background jobs failing or missing notifications.

Mitigation: Implement robust logging, retry mechanisms, and monitoring for cron jobs.

Risk: Complex state management for clock status and shifts.

Mitigation: Use a state management library like Zustand or Redux, with optimistic updates for a smooth UX.

7. Appendix
Supabase Docs: https://supabase.com/docs

Expo Location: https://docs.expo.dev/versions/latest/sdk/location/

Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/

React Native: https://reactnative.dev/docs/getting-started
