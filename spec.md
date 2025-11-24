# Pay to Watch, Quiz, and Test Website

## Overview
A web application that allows users to pay for access to content through QPay integration, with separate user and admin interfaces.

## User Authentication and Authorization
- User registration and login system
- Secure session management
- User account management
- **Fixed Automatic Registration**: All new users (Principals) are automatically registered on first login without requiring admin permissions
- **First User Admin Assignment**: The very first user to authenticate automatically becomes admin through `initializeAccessControl()`, all subsequent users automatically become regular users with `#user` role
- **Bulletproof User Registration**: `ensureUserRole(caller)` function automatically registers new principals as users without any authorization errors or "User is not registered" exceptions
- All authenticated users can retrieve their profiles without authorization errors
- **Idempotent Registration**: Once a user is registered, subsequent calls to `ensureUserRole` maintain their existing role without modification
- **Admin Preservation**: Admin users maintain their `#admin` role permanently and are never downgraded to `#user` on subsequent logins
- Role assignment logic completely prevents "Unauthorized: Only admins can assign user roles" errors

## Role-Based Authentication and Redirection
- **Fixed Login Flow**: After successful authentication, the system calls `getCallerUserRole()` to determine user role
- **Guaranteed Role Assignment**: `getCallerUserRole()` never returns `#guest` for authenticated users - all logged-in users have either `#admin` or `#user` role
- **Admin Redirection**: Users with `#admin` role are automatically redirected to the Admin Dashboard
- **User Redirection**: Users with `#user` role are automatically redirected to the User Dashboard
- **Role State Management**: Frontend stores the user role in state after fetching from backend using `useGetCallerUserRole` hook
- **Route Protection**: Admin routes are only accessible to users with `#admin` role, user routes only to users with `#user` role
- **Conditional Dashboard Display**: App.tsx routing conditionally displays the correct dashboard based on the role fetched from backend
- **Role Persistence**: User role is maintained throughout the session and properly validated on route access
- **Sequential Role Fetching**: Role fetching occurs only after complete page load and authentication completion, preventing premature guest fallback states

## Frontend Loading and Actor Initialization Sequence - CRITICAL FIX for Double Agent Warning and Infinite Loading
- **CRITICAL Actor Initialization Fix**: Complete elimination of "Detected both agent and agentOptions passed to createActor" warning through exclusive parameter usage
- **Single Parameter Actor Creation**: `useActor.ts` passes ONLY ONE parameter to `createActor` - either `agent` OR `agentOptions`, never both simultaneously
- **Exclusive Parameter Logic**: Actor initialization uses strict conditional logic - if agent exists, pass only agent; if no agent, pass only agentOptions
- **Sequential Initialization Flow**: App.tsx follows strict sequence:
  1. Wait for Internet Identity authentication to complete
  2. Wait for agent to be fully resolved and available
  3. Create actor with single parameter (agent OR agentOptions)
  4. Wait for actor to be defined and ready
  5. Proceed with user registration and role fetching
- **Actor Readiness Verification**: All backend calls wait until actor is confirmed ready and available
- **Redundant CreateActor Call Elimination**: Remove all duplicate or parallel `createActor` calls that cause double agent initialization
- **Loading State Management with Actor Readiness**: App.tsx includes comprehensive `isActorReady` check that verifies:
  - Actor is defined and not undefined
  - Actor methods are callable
  - Network connection is stable
  - Backend canister is responsive
- **Error Handling and Retry Logic**: Implement robust error handling for actor initialization failures with exponential backoff retry
- **Loading Screen Completion Logic**: Loading screen disappears only after ALL initialization steps complete successfully:
  - Internet Identity authentication complete
  - Agent fully resolved
  - Actor created without warnings
  - Actor readiness confirmed
  - User registration completed
  - User role fetched successfully
- **Automatic Registration Verification**: Logged-in users are automatically registered without "User is not registered" errors
- **Network Connection Validation**: System ensures stable network connection before attempting backend operations
- **Agent Resolution Wait**: Frontend waits for complete Internet Identity agent resolution before proceeding
- **Initialization State Tracking**: Comprehensive state management to track each initialization step and prevent premature UI rendering
- **Clean Actor Creation Flow**: Actor creation process guarantees zero double initialization warnings
- **Concurrent Request Prevention**: Prevent multiple simultaneous actor creation attempts that could cause parameter conflicts
- **Memory Leak Prevention**: Proper cleanup of failed actor initialization attempts
- **Backend Readiness Check**: Verify backend canister is ready to accept connections before proceeding with business logic

## Backend Initialization Stability - Enhanced Canister Readiness
- **Canister Boot Stability**: All initialization endpoints (`initializeAccessControl`, `ensureCallerUserRole`) are guaranteed stable and never cause traps during actor boot
- **Backend Readiness Verification**: Implement backend readiness check endpoint that confirms canister is fully initialized and ready for connections
- **Graceful Initialization**: Backend initialization logic handles concurrent access during canister startup without conflicts
- **Retry and Backoff Logic**: Backend implements exponential backoff for initial connection attempts during canister warm-up
- **Connection Stability**: Backend maintains stable connections and handles temporary network interruptions gracefully
- **Error Recovery**: Backend automatically recovers from temporary initialization failures without requiring canister restart
- **Concurrent Access Handling**: Backend safely handles multiple simultaneous initialization requests during startup
- **Resource Availability**: Backend ensures all required resources are available before accepting actor connections
- **Initialization Logging**: Comprehensive logging of backend initialization steps for debugging and monitoring
- **State Consistency**: Backend maintains consistent state during initialization and prevents race conditions

## Backend User Registration Safety - Complete Error Elimination
- **Critical Enhancement**: All backend shared functions (`makeQPayTokenRequest`, `makeQPayInvoiceRequest`, `getValidOrCreateInvoice`, `storeUserInvoice`, `recordPayment`, `checkPaymentStatus`, and `saveCallerUserProfile`) must call `ensureUserRole(caller)` at the beginning and never produce "User is not registered" errors
- **Bulletproof Safe User Registration**: Implement completely robust user registration system that eliminates all "User is not registered" errors:
  - **Fixed AccessControl.getUserRole**: Modified to return `#guest` instead of using `Debug.trap` when user is not found, preventing all trap-related crashes
  - **Safe ensureUserRole Function**: `ensureUserRole(caller)` function safely upgrades `#guest` users to appropriate role without any errors or exceptions
  - **Automatic Registration for All Functions**: Every user-facing backend function automatically registers unregistered callers before proceeding with business logic
  - **Enhanced Registration Flow**: `ensureUserRole` always calls `AccessControl.initialize` for new users, even when `getUserRole` initially returns `#guest` or fails
  - **Smart Role Assignment**: First caller gets `#admin` role, all subsequent callers get `#user` role automatically through proper `initializeAccessControl` logic
  - **Idempotency Protection**: Skip registration if user already has `#user` or `#admin` role to prevent role changes
  - **Comprehensive Logging**: Add debug logs to confirm when new users are registered and their role updated to "user"
- **Universal Access**: All functions that previously required manual registration (`saveCallerUserProfile`, `storeUserInvoice`, `recordPayment`, payment and invoice functions) are now accessible by unregistered callers and internally auto-register them
- **First-Time User Experience**: First login and first Pay button click never produce "User is not registered" rejection
- Preserve existing admin/user behavior for permissions, keeping admin validation secure
- **Zero Registration Errors**: No "User is not registered" errors occur during any user flow, especially QPay payment operations
- Backend automatically registers and proceeds seamlessly without user-facing errors
- **Enhanced Safe Registration Logic**: `ensureUserRole` function must handle all edge cases:
  - New callers (not in system) are automatically registered with appropriate role (`#admin` for first user, `#user` for subsequent users)
  - Existing users maintain their current roles without modification
  - Admin users are never downgraded to user role on re-login
  - Function never throws exceptions or authorization errors using `Debug.trap`
  - Proper initialization state management prevents system corruption
  - All QPay workflow functions are guaranteed to have properly registered callers before authorization checks
- **Fixed Access Control Initialize**: `AccessControl.initialize` correctly registers the first caller as admin and ensures all subsequent users become `#user` without registration errors
- **Safe Entry Points**: All backend entry points (`getCallerUserProfile`, `getValidOrCreateInvoice`, login functions) automatically ensure proper user registration without throwing traps or authorization errors
- **Verified Safe Guest Handling**: Ensure no traps occur anywhere due to `getUserRole` throwing, with safe guest handling throughout the backend

## Fixed Backend Access Control Logic - Permanent Admin Registration and Safe User Registration
- **Critical Admin Registration Fix**: First caller of the system is automatically and permanently registered as admin in `registeredUsers` storage
- **Sequential Role Assignment**: System tracks initialization state to assign `#admin` to first user and `#user` to all subsequent users
- **Defensive Registration Detection**: `ensureUserRole` correctly detects unregistered principals without triggering `AccessControl.getUserRole` trap by checking registration status before role queries
- **Admin Login Verification**: On admin login, `isAdmin()` and `getCallerUserRole()` correctly return `#admin` role, allowing admin dashboard to load without rejection or unauthorized errors
- **User Login Verification**: On user login, `getCallerUserRole()` correctly returns `#user` role, never `#guest` for authenticated users
- **Backward Compatibility**: Maintain complete compatibility for existing stored users and invoices with no reset or duplication of stored invoice data
- **Enhanced Debug Logging**: Add comprehensive debug logs in `initializeAccessControl()`, `ensureUserRole()`, and `hasCallerPermission()` functions to confirm proper registration flow for both admin and regular users
- **Safe Role Detection**: Registration functions check user existence in `registeredUsers` before attempting role queries to prevent traps
- **Permanent Admin Storage**: First caller admin registration is stored permanently and persists across canister upgrades
- **User Auto-Registration**: All authenticated users clicking "Pay" are automatically registered with `user` role without any "User is not registered" errors
- **Role Query Safety**: All role-checking functions handle unregistered users gracefully without using `Debug.trap`
- **Frontend Role State Update**: `useGetCallerUserRole` hook correctly updates React state with the actual role returned from backend, ensuring proper dashboard routing

## User Interface
- After login, users see only a Pay button with no invoice information displayed
- Invoice information is never shown automatically on login or page load
- Invoice information is only shown after clicking the Pay button and successful invoice retrieval/creation
- Payment flow integrates with QPay API
- Clean, responsive design using Tailwind CSS
- Dynamic invoice response display after successful payment request

## Payment Response Display
When the Pay button is pressed and invoice is successfully retrieved or created:
- Display invoice response data dynamically (not permanently stored)
- Show QR code button in top-right corner that opens modal popup with QR image
- QR code image must be displayed correctly using `<img src={qr_image}>` with proper alt text
- QR modal must adjust to image size automatically
- Display list of available banks from the `urls` array, each showing:
  - Bank logo image
  - Bank name as title
  - Bank description text
- Extract and use `invoice_id`, `qr_text`, `qr_image`, `qPay_shortUrl`, and `urls` fields from QPay response
- Layout matches provided design screenshots with proper Mongolian styling

## Payment Status Monitoring and Post-Payment Behavior
- **Automatic Payment Status Checking**: When user opens the website and has an unpaid invoice, check payment status once automatically using the QPay check endpoint
- **Real-time Payment Polling**: When user clicks Pay button and enters payment view, start checking payment status every 5 seconds
- **QPay Status Check Integration**: Use existing QPay token to send POST requests to `https://merchant.qpay.mn/v2/payment/check` with JSON body containing:
  - `object_type`: "INVOICE"
  - `object_id`: the invoice ID from QPay response
  - `offset`: page_number 1, page_limit 100
- **Payment Status Logic**:
  - Response with `count: 0` indicates payment is still pending
  - Response with `count > 0` indicates payment is confirmed
  - When payment confirmed, call existing `updateInvoicePaymentStatus` to mark invoice as paid in backend
- **Polling Management**:
  - Polling only occurs within the payment view (QPay payment screen)
  - Polling stops immediately when payment is confirmed (count > 0)
  - Polling stops when user leaves the payment page
  - No polling on other pages or when no invoice exists
- **UI Payment Status Feedback**: Display real-time payment status updates while polling is active
- **Backend Payment Status Function**: Implement `checkPaymentStatus` function that accepts invoice ID and QPay token, makes the status check API call, and returns payment confirmation status
- **Fixed Post-Payment Automatic Redirection**: After payment is confirmed (paid invoice detected via polling or initial check):
  - Payment section immediately hides from view without delay
  - Active polling timer is immediately cleared and stopped to prevent further background checks
  - All payment-related state is properly cleaned up to prevent memory leaks
  - User is smoothly redirected to the homepage (LandingPage) after payment confirmation
  - Redirection occurs only after backend successfully marks invoice as paid
  - Prevents UI flickering or double-navigation during the transition
  - Behavior is limited strictly to the payment view, leaving admin and other sections unaffected
  - **Enhanced State Cleanup**: Ensure all polling intervals, timers, and payment-related state variables are properly cleared when payment becomes paid
  - **Immediate UI Response**: Payment section hides instantly upon receiving payment confirmation response, providing immediate visual feedback
  - **Single Redirection**: Redirection logic executes only once per payment confirmation to prevent multiple navigation attempts

## Admin Dashboard
- Admin login with elevated privileges
- User management interface to view and manage registered users
- Payment information viewing capabilities with correct timestamp display
- QPay configuration section with input fields for:
  - `client_username`
  - `client_password` 
  - `client_invoice`
  - `sender_invoice_no` (default: "12345678")
  - `invoice_receiver_code` (default: "terminal")
  - `invoice_description` (default: "Railway эрх 12сар")
  - `amount` (default: 10)
- Proper error handling and loading states for all data queries
- Console logging for debugging query errors
- Fallback "no data" UI when queries fail after retry
- "Login again" prompts for unauthorized responses instead of infinite loading
- React Query invalidation triggers after successful QPay configuration updates to refresh user payment screens
- **Fixed Admin Invoice Display**: Admin interface shows all invoices that have been created without duplicates, maintaining complete historical records with proper deduplication logic
- **Fixed Historical Invoice Amount Display**: Admin dashboard invoice list displays the original amount that was stored with each invoice at creation time, not the current QPay configuration amount
- **Real-time Configuration Updates**: When admin updates invoice configuration values (amount, sender_invoice_no, receiver_code, description), the backend immediately updates and all subsequent user invoices reflect the new values
- **Configuration Refetch Logic**: Admin dashboard frontend refetches and displays the most up-to-date invoice configuration before rendering invoice data
- **Historical Amount Preservation**: Each invoice record displays its own `invoice.amount` field that was saved during invoice creation, preserving historical pricing data

## User Dashboard
- Proper error handling and loading states for all data queries
- Console logging for debugging query errors
- Fallback "no data" UI when queries fail after retry
- "Login again" prompts for unauthorized responses instead of infinite loading
- Profile loading no longer gets stuck at "Уншиж байна..." due to fixed backend authorization
- No invoice information is displayed when user first logs in or opens payment page
- **Automatic Payment Check on Load**: When user opens the website, if there is an unpaid invoice, automatically check payment status once using QPay check endpoint
- Invoice information is only displayed after user clicks the Pay button
- When user clicks Pay button:
  - **Seamless Auto-Registration**: Backend automatically registers new users via `ensureUserRole(caller)` before any invoice operations
  - Backend fetches the latest QPay configuration values from admin settings before any invoice operations
  - Check for existing valid invoice (unpaid and created within 24 hours)
  - If existing valid invoice found, display that invoice without creating new record or calling QPay API
  - If no invoice exists, or invoice is older than 24 hours, or invoice is paid, create new invoice using freshly fetched admin configuration
  - Show invoice response details (QR code, URLs list) as returned by QPay
  - **Start Payment Status Polling**: Begin checking payment status every 5 seconds within the payment view
- Payment UI always displays the most recent `invoice_description` and `amount` from backend queries when creating new invoices
- React Query automatically refetches QPay configuration data when admin updates are made

## Frontend Data Synchronization
- React Query invalidation system ensures user payment screens reflect updated QPay configuration immediately
- When admin successfully updates invoice configuration (`sender_invoice_no`, `invoice_receiver_code`, `invoice_description`, `amount`), the system triggers cache invalidation
- User payment UI refetches QPay configuration data automatically after admin changes
- No cached or stale data displayed on user payment screens - always shows current backend values
- Proper query key management ensures data consistency across admin and user interfaces
- Invoice creation uses the most up-to-date configuration values from backend
- **Fixed Frontend Invoice Display**: Frontend correctly displays one invoice per user without duplication on admin view and properly handles data refresh
- **Fixed Role State Management**: `useGetCallerUserRole` hook in `frontend/src/hooks/useQueries.ts` correctly updates React state with the role returned from backend, ensuring proper dashboard routing for both admins and users
- **Enhanced Configuration Synchronization**: Admin dashboard automatically refetches QPay configuration data before displaying invoice information to ensure displayed amounts match current settings
- **Historical Invoice Amount Display**: Frontend admin dashboard displays the original `invoice.amount` stored with each invoice record, not the current configuration amount
- **Concurrent Request Prevention**: Frontend prevents multiple simultaneous React Query requests that could trigger conflicting agent states
- **Query Deduplication**: React Query hooks implement proper deduplication to prevent multiple identical backend calls
- **State Consistency**: Frontend maintains consistent state across all components and prevents race conditions in data fetching

## Date and Time Display
- All payment timestamps must be displayed in Asia/Ulaanbaatar timezone
- Format timestamps as `YYYY-MM-DD HH:mm:ss` using client local time
- PaymentRecord timestamp field must store current time using `Time.now()` when record is created
- Frontend timestamp rendering logic must correctly display formatted dates instead of "-" in both admin and user dashboards
- Proper date conversion from stored timestamp data to prevent empty date display

## Query Error Handling
- All React Query hooks must include proper error and empty-state handling
- Failed or pending backend responses show user-visible messages instead of stuck loading states
- QPay credential and payment information queries automatically retry once
- After retry failure, display fallback "no data" UIs in Mongolian
- Console logging for all query errors to assist debugging
- Unauthorized responses trigger "Login again" prompts instead of hanging loaders

## QPay Integration - Fixed Token Request Logic for Invoice Reuse
The payment process follows this enhanced flow:
1. User clicks Pay button (no invoice information shown before this)
2. **Enhanced Registration Safety**: Backend first ensures caller is registered as user using bulletproof `ensureUserRole` that never throws "User is not registered" errors or uses `Debug.trap`
3. Backend fetches the latest QPay configuration values from admin settings
4. **Fixed Invoice Reuse Logic**: Backend checks for existing unpaid invoice created within past 24 hours for the user using proper timestamp comparison
5. **Fixed Token Request Logic - Skip for Reused Invoices**: 
   - **Critical Fix**: If valid existing invoice found (unpaid and less than 24 hours old), return that invoice data with `isNewInvoice = false` without creating new record, calling QPay API, or requesting new token
   - **Token Request Only for New Invoices**: Token generation call (`makeQPayTokenRequest`) only executes when `isNewInvoice = true`
   - **Frontend Token Skip Logic**: Frontend completely skips token request step when `getValidOrCreateInvoice` returns `isNewInvoice = false`
   - **Logging Confirmation**: Backend logs "Token not requested for reused invoice" when existing invoice is returned
6. If no valid invoice exists, or existing invoice is older than 24 hours, or existing invoice is paid:
   - Check invoice status using QPay's `https://merchant.qpay.mn/v2/payment/check` endpoint if needed
   - **New Invoice Creation Flow**: Only when creating new invoices (`isNewInvoice = true`):
     - Request new QPay token using proper authentication
     - Create new invoice using freshly fetched admin configuration values
     - **Store Invoice with Current Amount**: Save the actual `amount` value from current QPay configuration into the invoice record during creation
     - Store new invoice record in backend data using `storeUserInvoice` only for newly created invoices
7. **Token Request Process** (only for new invoices when `isNewInvoice = true`):
   - Backend retrieves stored QPay credentials and uses current invoice configuration from admin settings
   - Backend calls QPay token endpoint with proper authentication:
     - Concatenates `client_username:client_password` as a single string
     - Encodes the concatenated string in Base64
     - Sends POST request to `https://merchant.qpay.mn/v2/auth/token`
     - Uses `Authorization: Basic [base64-encoded-credentials]` header format
     - Sends empty JSON `{}` body with `Content-Type: application/json`
     - Logs response in console for debugging
     - Returns parsed response text to frontend
8. **Invoice Creation Process** (only for new invoices with valid token):
   - Backend calls QPay invoice endpoint with token:
     - Sends POST request to `https://merchant.qpay.mn/v2/invoice`
     - Uses `Authorization: Bearer [token]` header
     - Sends JSON body with invoice details using freshly fetched admin-configured values:
       - `sender_invoice_no` from admin settings
       - `invoice_receiver_code` from admin settings
       - `invoice_description` from admin settings
       - `amount` from admin settings
       - `client_invoice` code from admin settings
     - Returns raw JSON response as text string
9. Frontend displays invoice response data dynamically in user interface only after Pay button click
10. **Payment Status Monitoring**: Start 5-second polling of payment status within the payment view using QPay check endpoint
11. **Performance Optimization**: Reusing existing valid invoices improves performance by avoiding unnecessary QPay API calls and token requests
12. **Frontend Payment Flow Alignment**: Frontend payment logic checks `isNewInvoice` flag and only calls token request functions when `isNewInvoice = true`, completely bypassing token requests for reused invoices
13. Proper error handling for missing credentials and unparseable token responses

## Invoice Management Logic - Fixed Historical Amount Storage and Display
- Backend always fetches latest QPay configuration before invoice operations
- Backend stores invoice creation timestamps using `Time.now()`
- **Fixed 24-Hour Logic**: Date comparison logic correctly determines if 24 hours have passed since invoice creation using proper timestamp arithmetic
- Invoice status checking via QPay API before creating new invoices
- **Clear Operation Separation**: Distinct separation between "retrieving existing invoices" and "creating new invoices" operations to prevent duplicate storage
- `getValidOrCreateInvoice` function returns an `isNewInvoice` flag to indicate whether a new invoice was created
- **Fixed Conditional Token Request**: Frontend only calls token request functions when `isNewInvoice = true`, completely skipping token requests when reusing existing invoices
- **Fixed Invoice Storage Logic**:
  - `storeUserInvoice` function only called when `isNewInvoice = true` to prevent duplicate entries
  - **Historical Amount Storage**: When creating new invoices, store the current `qpayInvoiceConfig.amount` value directly in the invoice record's `amount` field
  - When retrieving existing valid invoices, no storage operations are performed
  - Invoice storage uses unique identifiers and append-only operations that never delete or overwrite existing invoice records
  - Existing invoices remain permanently visible in the admin invoice list
  - No filtering or replacement operations that could cause historical invoices to disappear
  - `getAllInvoices` function returns all stored invoice records with proper deduplication logic to show one invoice per user per time period
- **Duplicate Prevention**:
  - Backend logic prevents calling `storeUserInvoice` when returning existing valid invoices
  - Only newly created invoices (when calling QPay API) trigger storage operations
  - Proper conditional logic ensures existing invoice retrieval does not modify database
  - Set `isNewInvoice = false` when returning existing invoices to prevent frontend confusion
- **Data Integrity Requirements**:
  - All invoice records persist indefinitely in backend storage
  - No operations cause existing invoices to be removed from `getAllInvoices` results
  - Invoice storage operations are safe and non-destructive to existing data
  - Admin dashboard shows complete historical invoice records without duplicates
  - **Fixed Missing Invoice Issue**: Proper invoice persistence ensures no invoices disappear from admin view
- **Historical Amount Preservation**: Each invoice record contains its own `amount` field that reflects the QPay configuration amount at the time of invoice creation, ensuring historical pricing accuracy
- Track invoice payment status and expiration without affecting data persistence
- No automatic display of invoice information on user login or page load
- All new invoices use the most current admin configuration values and store those values in the invoice record
- Backend logging verifies that all invoice operations preserve existing data integrity
- **Invoice Amount Independence**: Stored invoice amounts are independent of current QPay configuration changes, preserving historical pricing data

## Backend Data Storage
- User accounts and authentication data
- Admin QPay credentials (client_username, client_password, client_invoice)
- Admin QPay invoice configuration (sender_invoice_no, invoice_receiver_code, invoice_description, amount)
- Payment transaction records with proper timestamp using `Time.now()`
- **Persistent Invoice Records**: All invoice records with creation timestamps, payment status, and original amount values stored permanently with append-only operations that ensure no historical data loss and prevent duplicates
- **Historical Amount Storage**: Each invoice record stores its own `amount` field containing the QPay configuration amount that was active when the invoice was created
- User payment status and access permissions
- **Configuration State Management**: Backend maintains current QPay configuration state and provides synchronized access to ensure displayed amounts match current settings

## Security Requirements
- All sensitive data stored securely in backend
- No sensitive information in frontend local storage
- Secure API communication between frontend and backend
- Protected admin routes and functionality

## Language
- All application content in Mongolian
