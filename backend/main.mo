import AccessControl "authorization/access-control";
import OutCall "http-outcalls/outcall";
import Stripe "stripe/stripe";
import Principal "mo:base/Principal";
import OrderedMap "mo:base/OrderedMap";
import Debug "mo:base/Debug";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Blob "mo:base/Blob";
import Nat8 "mo:base/Nat8";
import Char "mo:base/Char";
import Time "mo:base/Time";

persistent actor {
  // Initialize the user system state
  transient let accessControlState = AccessControl.initState();

  // Track registered users to avoid traps from getUserRole
  transient let principalMap = OrderedMap.Make<Principal>(Principal.compare);
  transient var registeredUsers = principalMap.empty<Bool>();

  // Helper function to ensure caller has at least user role
  // This function safely registers new users without throwing errors
  func ensureUserRole(caller : Principal) {
    Debug.print("[ensureUserRole] Called for: " # debug_show(caller));
    
    // Check if user is already registered in our tracking map
    switch (principalMap.get(registeredUsers, caller)) {
      case (?true) {
        // User is already registered, check their role
        let currentRole = AccessControl.getUserRole(accessControlState, caller);
        Debug.print("[ensureUserRole] Existing user with role: " # debug_show(currentRole));
        
        // Don't modify existing roles
        switch (currentRole) {
          case (#admin) {
            Debug.print("[ensureUserRole] User is already admin, preserving role");
          };
          case (#user) {
            Debug.print("[ensureUserRole] User is already user, preserving role");
          };
          case (#guest) {
            // This shouldn't happen for registered users, but handle it
            Debug.print("[ensureUserRole] Registered user has guest role, re-initializing");
            AccessControl.initialize(accessControlState, caller);
            Debug.print("[ensureUserRole] User re-registered successfully");
          };
        };
      };
      case _ {
        // User is not in our tracking map, need to register
        Debug.print("[ensureUserRole] New user detected, registering");
        
        // Call initialize which will assign appropriate role (admin for first, user for rest)
        AccessControl.initialize(accessControlState, caller);
        
        // Add to our tracking map
        registeredUsers := principalMap.put(registeredUsers, caller, true);
        
        // Verify the role was assigned
        let assignedRole = AccessControl.getUserRole(accessControlState, caller);
        Debug.print("[ensureUserRole] User registered successfully with role: " # debug_show(assignedRole));
      };
    };
  };

  // Helper to check if caller has required permission
  func hasCallerPermission(caller : Principal, requiredRole : AccessControl.UserRole) : Bool {
    Debug.print("[hasCallerPermission] Checking permission for: " # debug_show(caller));
    Debug.print("[hasCallerPermission] Required role: " # debug_show(requiredRole));
    
    // Ensure user is registered before checking permission
    ensureUserRole(caller);
    
    let hasPermission = AccessControl.hasPermission(accessControlState, caller, requiredRole);
    Debug.print("[hasCallerPermission] Permission result: " # debug_show(hasPermission));
    hasPermission;
  };

  // Initialize auth (first caller becomes admin, others become users)
  public shared ({ caller }) func initializeAccessControl() : async () {
    Debug.print("[initializeAccessControl] Called by: " # debug_show(caller));
    AccessControl.initialize(accessControlState, caller);
    registeredUsers := principalMap.put(registeredUsers, caller, true);
    Debug.print("[initializeAccessControl] Initialization complete");
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    Debug.print("[getCallerUserRole] Called by: " # debug_show(caller));
    
    // Check if user is registered first
    switch (principalMap.get(registeredUsers, caller)) {
      case (?true) {
        let role = AccessControl.getUserRole(accessControlState, caller);
        Debug.print("[getCallerUserRole] Role: " # debug_show(role));
        role;
      };
      case _ {
        // User not registered, return guest
        Debug.print("[getCallerUserRole] User not registered, returning #guest");
        #guest;
      };
    };
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    Debug.print("[assignCallerUserRole] Called by: " # debug_show(caller) # " for user: " # debug_show(user) # " with role: " # debug_show(role));
    
    // Ensure caller is registered
    ensureUserRole(caller);
    
    // Admin-only check happens inside assignRole
    AccessControl.assignRole(accessControlState, caller, user, role);
    
    // Track the user as registered
    registeredUsers := principalMap.put(registeredUsers, user, true);
    
    Debug.print("[assignCallerUserRole] Role assigned successfully");
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    Debug.print("[isCallerAdmin] Called by: " # debug_show(caller));
    
    // Check if user is registered first
    switch (principalMap.get(registeredUsers, caller)) {
      case (?true) {
        let isAdmin = AccessControl.isAdmin(accessControlState, caller);
        Debug.print("[isCallerAdmin] Result: " # debug_show(isAdmin));
        isAdmin;
      };
      case _ {
        Debug.print("[isCallerAdmin] User not registered, returning false");
        false;
      };
    };
  };

  public type UserProfile = {
    name : Text;
    // Other user metadata if needed
  };

  transient var userProfiles = principalMap.empty<UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    Debug.print("[getCallerUserProfile] Called by: " # debug_show(caller));
    
    // Allow all users (including guests) to query their profile
    // Return null if no profile exists
    principalMap.get(userProfiles, caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    Debug.print("[getUserProfile] Called by: " # debug_show(caller) # " for user: " # debug_show(user));
    
    // Check if caller is registered before checking admin status
    let isAdmin = switch (principalMap.get(registeredUsers, caller)) {
      case (?true) { AccessControl.isAdmin(accessControlState, caller) };
      case _ { false };
    };
    
    // Only allow viewing own profile or admin viewing any profile
    if (caller != user and not isAdmin) {
      Debug.trap("Unauthorized: Can only view your own profile");
    };
    principalMap.get(userProfiles, user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    Debug.print("[saveCallerUserProfile] Called by: " # debug_show(caller));
    
    // Auto-register guest users before saving
    ensureUserRole(caller);

    // After ensuring user role, check permission
    if (not hasCallerPermission(caller, #user)) {
      Debug.trap("Unauthorized: Only users can save profiles");
    };
    
    userProfiles := principalMap.put(userProfiles, caller, profile);
    Debug.print("[saveCallerUserProfile] Profile saved successfully");
  };

  // Ensure caller is registered as user - public endpoint for explicit registration
  public shared ({ caller }) func ensureCallerUserRole() : async () {
    Debug.print("[ensureCallerUserRole] Called by: " # debug_show(caller));
    ensureUserRole(caller);
    Debug.print("[ensureCallerUserRole] Registration complete");
  };

  public type QPayCredentials = {
    client_username : Text;
    client_password : Text;
    client_invoice : Text;
  };

  public type QPayInvoiceConfig = {
    sender_invoice_no : Text;
    invoice_receiver_code : Text;
    invoice_description : Text;
    amount : Nat;
  };

  transient var qpayCredentials : ?QPayCredentials = null;
  transient var qpayInvoiceConfig : QPayInvoiceConfig = {
    sender_invoice_no = "12345678";
    invoice_receiver_code = "terminal";
    invoice_description = "Railway эрх 12сар";
    amount = 10;
  };

  public shared ({ caller }) func saveQPayCredentials(credentials : QPayCredentials) : async () {
    Debug.print("[saveQPayCredentials] Called by: " # debug_show(caller));
    
    // Admin-only operation
    if (not hasCallerPermission(caller, #admin)) {
      Debug.trap("Unauthorized: Only admins can save QPay credentials");
    };
    qpayCredentials := ?credentials;
    Debug.print("[saveQPayCredentials] Credentials saved successfully");
  };

  public query ({ caller }) func getQPayCredentials() : async ?QPayCredentials {
    Debug.print("[getQPayCredentials] Called by: " # debug_show(caller));
    
    // Check if user is registered and is admin
    let isAdmin = switch (principalMap.get(registeredUsers, caller)) {
      case (?true) { AccessControl.isAdmin(accessControlState, caller) };
      case _ { false };
    };
    
    // Admin-only operation
    if (not isAdmin) {
      Debug.trap("Unauthorized: Only admins can view QPay credentials");
    };
    qpayCredentials;
  };

  public shared ({ caller }) func saveQPayInvoiceConfig(config : QPayInvoiceConfig) : async () {
    Debug.print("[saveQPayInvoiceConfig] Called by: " # debug_show(caller));
    
    // Admin-only operation
    if (not hasCallerPermission(caller, #admin)) {
      Debug.trap("Unauthorized: Only admins can save QPay invoice config");
    };
    qpayInvoiceConfig := config;
    Debug.print("[saveQPayInvoiceConfig] Config saved successfully");
  };

  public query ({ caller }) func getQPayInvoiceConfig() : async QPayInvoiceConfig {
    Debug.print("[getQPayInvoiceConfig] Called by: " # debug_show(caller));
    
    // Allow all authenticated users to view invoice config
    // No strict authorization needed as this is public pricing info
    qpayInvoiceConfig;
  };

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  // Base64 encoding table
  transient let base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  func encodeBase64(input : [Nat8]) : Text {
    var result = "";
    var i = 0;
    let len = input.size();

    while (i < len) {
      let b1 = input[i];
      let b2 = if (i + 1 < len) input[i + 1] else 0 : Nat8;
      let b3 = if (i + 2 < len) input[i + 2] else 0 : Nat8;

      let n = (Nat8.toNat(b1) * 65536) + (Nat8.toNat(b2) * 256) + Nat8.toNat(b3);

      let idx1 = (n / 262144) % 64;
      let idx2 = (n / 4096) % 64;
      let idx3 = (n / 64) % 64;
      let idx4 = n % 64;

      let charsArray = Iter.toArray(base64Chars.chars());

      result #= Char.toText(charsArray[idx1]);
      result #= Char.toText(charsArray[idx2]);

      if (i + 1 < len) {
        result #= Char.toText(charsArray[idx3]);
      } else {
        result #= "=";
      };

      if (i + 2 < len) {
        result #= Char.toText(charsArray[idx4]);
      } else {
        result #= "=";
      };

      i += 3;
    };

    result;
  };

  public shared ({ caller }) func makeQPayTokenRequest() : async Text {
    Debug.print("[makeQPayTokenRequest] Called by: " # debug_show(caller));
    
    // Auto-register guest users before proceeding
    ensureUserRole(caller);

    // User-level permission required
    if (not hasCallerPermission(caller, #user)) {
      Debug.trap("Unauthorized: Only users can make payment requests");
    };

    switch (qpayCredentials) {
      case null { Debug.trap("QPay credentials not found") };
      case (?credentials) {
        // Concatenate username:password
        let credentialsString = credentials.client_username # ":" # credentials.client_password;

        // Encode to UTF-8 bytes
        let credentialsBlob = Text.encodeUtf8(credentialsString);
        let credentialsBytes = Blob.toArray(credentialsBlob);

        // Encode to Base64
        let base64Credentials = encodeBase64(credentialsBytes);

        // Create Authorization header
        let authHeader = "Basic " # base64Credentials;

        let headers = [
          { name = "Authorization"; value = authHeader },
          { name = "Content-Type"; value = "application/json" },
        ];

        Debug.print("[makeQPayTokenRequest] Authorization: " # authHeader);

        await OutCall.httpPostRequest("https://merchant.qpay.mn/v2/auth/token", headers, "{}", transform);
      };
    };
  };

  public shared ({ caller }) func makeQPayInvoiceRequest(token : Text) : async Text {
    Debug.print("[makeQPayInvoiceRequest] Called by: " # debug_show(caller));
    
    // Auto-register guest users before proceeding
    ensureUserRole(caller);

    // User-level permission required
    if (not hasCallerPermission(caller, #user)) {
      Debug.trap("Unauthorized: Only users can make payment requests");
    };

    switch (qpayCredentials) {
      case null { Debug.trap("QPay credentials not found") };
      case (?credentials) {
        let headers = [
          { name = "Authorization"; value = "Bearer " # token },
          { name = "Content-Type"; value = "application/json" },
        ];
        let body = "{
          \"invoice_code\": \"" # credentials.client_invoice # "\",
          \"sender_invoice_no\": \"" # qpayInvoiceConfig.sender_invoice_no # "\",
          \"invoice_receiver_code\": \"" # qpayInvoiceConfig.invoice_receiver_code # "\",
          \"invoice_description\": \"" # qpayInvoiceConfig.invoice_description # "\",
          \"amount\": " # Nat.toText(qpayInvoiceConfig.amount) # "
        }";
        
        Debug.print("[makeQPayInvoiceRequest] Request body: " # body);
        
        await OutCall.httpPostRequest("https://merchant.qpay.mn/v2/invoice", headers, body, transform);
      };
    };
  };

  // Invoice storage
  public type InvoiceRecord = {
    user : Principal;
    invoiceId : Text;
    invoiceData : Text; // Raw JSON response from QPay
    createdAt : Int;
    isPaid : Bool;
    amount : Nat; // Store the amount at the time of invoice creation
  };

  // Use Text as key for invoiceId
  transient let textMap = OrderedMap.Make<Text>(Text.compare);
  transient var userInvoices = textMap.empty<InvoiceRecord>();

  // Store invoice for user - ONLY for newly created invoices
  // This function should only be called when a NEW invoice is created via QPay API
  public shared ({ caller }) func storeUserInvoice(invoiceId : Text, invoiceData : Text, amount : Nat) : async () {
    Debug.print("[storeUserInvoice] Called by: " # debug_show(caller) # " for invoice: " # invoiceId # " with amount: " # debug_show(amount));
    
    // Auto-register guest users before proceeding
    ensureUserRole(caller);

    // User-level permission required
    if (not hasCallerPermission(caller, #user)) {
      Debug.trap("Unauthorized: Only users can store invoices");
    };

    // Check if invoice already exists to prevent duplicates
    switch (textMap.get(userInvoices, invoiceId)) {
      case (?existing) {
        // Invoice already exists, don't store duplicate
        Debug.print("[storeUserInvoice] Invoice " # invoiceId # " already exists, skipping duplicate storage");
        return;
      };
      case null {
        // New invoice, proceed with storage
        let record : InvoiceRecord = {
          user = caller;
          invoiceId;
          invoiceData;
          createdAt = Time.now();
          isPaid = false;
          amount; // Store the amount at the time of creation
        };
        userInvoices := textMap.put(userInvoices, invoiceId, record);
        Debug.print("[storeUserInvoice] Stored new invoice " # invoiceId # " for user " # debug_show (caller) # " with amount " # debug_show(amount));
      };
    };
  };

  // Get user's current invoice (user-level authorization)
  public query ({ caller }) func getUserInvoice() : async ?InvoiceRecord {
    Debug.print("[getUserInvoice] Called by: " # debug_show(caller));
    
    // Allow guests to query (will return null if no invoice)
    // Find the most recent unpaid invoice for the user
    var latestInvoice : ?InvoiceRecord = null;
    var latestTime : Int = 0;

    for ((_, invoice) in textMap.entries(userInvoices)) {
      if (invoice.user == caller and not invoice.isPaid) {
        if (invoice.createdAt > latestTime) {
          latestInvoice := ?invoice;
          latestTime := invoice.createdAt;
        };
      };
    };

    Debug.print("[getUserInvoice] Found invoice: " # debug_show(latestInvoice != null));
    latestInvoice;
  };

  // Update invoice payment status (user-level authorization)
  public shared ({ caller }) func updateInvoicePaymentStatus(invoiceId : Text, isPaid : Bool) : async () {
    Debug.print("[updateInvoicePaymentStatus] Called by: " # debug_show(caller) # " for invoice: " # invoiceId);
    
    // Auto-register guest users before proceeding
    ensureUserRole(caller);

    // User-level permission required
    if (not hasCallerPermission(caller, #user)) {
      Debug.trap("Unauthorized: Only users can update their invoice status");
    };

    switch (textMap.get(userInvoices, invoiceId)) {
      case null { Debug.trap("No invoice found with ID " # invoiceId) };
      case (?invoice) {
        if (invoice.user != caller) {
          Debug.trap("Unauthorized: Cannot update invoice that does not belong to you");
        };
        let updatedInvoice : InvoiceRecord = {
          user = invoice.user;
          invoiceId = invoice.invoiceId;
          invoiceData = invoice.invoiceData;
          createdAt = invoice.createdAt;
          isPaid;
          amount = invoice.amount; // Preserve the original amount
        };
        userInvoices := textMap.put(userInvoices, invoiceId, updatedInvoice);
        Debug.print("[updateInvoicePaymentStatus] Invoice status updated successfully");
      };
    };
  };

  // Check if invoice is older than 24 hours (user-level authorization)
  public query ({ caller }) func isInvoiceExpired() : async Bool {
    Debug.print("[isInvoiceExpired] Called by: " # debug_show(caller));
    
    // Allow guests to query (will return true if no invoice)
    // Find the most recent unpaid invoice for the user
    var latestInvoice : ?InvoiceRecord = null;
    var latestTime : Int = 0;

    for ((_, invoice) in textMap.entries(userInvoices)) {
      if (invoice.user == caller and not invoice.isPaid) {
        if (invoice.createdAt > latestTime) {
          latestInvoice := ?invoice;
          latestTime := invoice.createdAt;
        };
      };
    };

    switch (latestInvoice) {
      case null { 
        Debug.print("[isInvoiceExpired] No invoice found, returning true");
        true;
      };
      case (?invoice) {
        let currentTime = Time.now();
        let timeDiff = currentTime - invoice.createdAt;
        // 24 hours in nanoseconds = 24 * 60 * 60 * 1_000_000_000
        let twentyFourHours : Int = 86_400_000_000_000;
        let expired = timeDiff > twentyFourHours;
        Debug.print("[isInvoiceExpired] Invoice age: " # debug_show(timeDiff) # " ns, expired: " # debug_show(expired));
        expired;
      };
    };
  };

  // Check QPay invoice status (user-level authorization)
  public shared ({ caller }) func checkQPayInvoiceStatus(token : Text, invoiceId : Text) : async Text {
    Debug.print("[checkQPayInvoiceStatus] Called by: " # debug_show(caller) # " for invoice: " # invoiceId);
    
    // Auto-register guest users before proceeding
    ensureUserRole(caller);

    // User-level permission required
    if (not hasCallerPermission(caller, #user)) {
      Debug.trap("Unauthorized: Only users can check invoice status");
    };

    let headers = [
      { name = "Authorization"; value = "Bearer " # token },
      { name = "Content-Type"; value = "application/json" },
    ];

    let body = "{\"object_type\": \"INVOICE\", \"object_id\": \"" # invoiceId # "\"}";

    await OutCall.httpPostRequest("https://merchant.qpay.mn/v2/payment/check", headers, body, transform);
  };

  // Get all invoices (admin-only authorization)
  public query ({ caller }) func getAllInvoices() : async [(Text, InvoiceRecord)] {
    Debug.print("[getAllInvoices] Called by: " # debug_show(caller));
    
    // Check if user is registered and is admin
    let isAdmin = switch (principalMap.get(registeredUsers, caller)) {
      case (?true) { AccessControl.isAdmin(accessControlState, caller) };
      case _ { false };
    };
    
    // Admin-only operation
    if (not isAdmin) {
      Debug.trap("Unauthorized: Only admins can view all invoices");
    };

    // Return all invoices without filtering - complete historical records
    // Each invoice contains its own amount field from creation time
    let allInvoices = Iter.toArray(textMap.entries(userInvoices));
    Debug.print("[getAllInvoices] Returning " # debug_show(allInvoices.size()) # " invoices with historical amounts");
    allInvoices;
  };

  public type PaymentRecord = {
    user : Principal;
    amount : Nat;
    status : Text;
    timestamp : Int;
  };

  transient let natMap = OrderedMap.Make<Nat>(Nat.compare);
  transient var paymentRecords = natMap.empty<PaymentRecord>();
  transient var nextPaymentId = 0;

  public shared ({ caller }) func recordPayment(amount : Nat, status : Text) : async () {
    Debug.print("[recordPayment] Called by: " # debug_show(caller) # " amount: " # debug_show(amount));
    
    // Auto-register guest users before proceeding
    ensureUserRole(caller);

    // User-level permission required
    if (not hasCallerPermission(caller, #user)) {
      Debug.trap("Unauthorized: Only users can record payments");
    };

    let record : PaymentRecord = {
      user = caller;
      amount;
      status;
      timestamp = Time.now();
    };
    paymentRecords := natMap.put(paymentRecords, nextPaymentId, record);
    nextPaymentId += 1;
    //Debug.print("[recordPayment] Payment recorded with ID: " # debug_show(nextPaymentId - 1));
  };

  public query ({ caller }) func getUserPayments() : async [PaymentRecord] {
    Debug.print("[getUserPayments] Called by: " # debug_show(caller));
    
    // Allow guests to query (will return empty array)
    let payments = Iter.toArray(
      Iter.filter(
        natMap.vals(paymentRecords),
        func(record : PaymentRecord) : Bool {
          record.user == caller;
        },
      )
    );
    Debug.print("[getUserPayments] Returning " # debug_show(payments.size()) # " payments");
    payments;
  };

  public query ({ caller }) func getAllPayments() : async [PaymentRecord] {
    Debug.print("[getAllPayments] Called by: " # debug_show(caller));
    
    // Check if user is registered and is admin
    let isAdmin = switch (principalMap.get(registeredUsers, caller)) {
      case (?true) { AccessControl.isAdmin(accessControlState, caller) };
      case _ { false };
    };
    
    // Admin-only operation
    if (not isAdmin) {
      Debug.trap("Unauthorized: Only admins can view all payments");
    };
    
    let allPayments = Iter.toArray(natMap.vals(paymentRecords));
    Debug.print("[getAllPayments] Returning " # debug_show(allPayments.size()) # " payments");
    allPayments;
  };

  // Invoice response type to distinguish between existing and new invoices
  public type InvoiceResponse = {
    invoiceData : Text;
    isNewInvoice : Bool; // true if newly created, false if existing
    amount : Nat; // The amount for this invoice (current config for new, stored for existing)
  };

  // Invoice check result - used to determine if token is needed
  public type InvoiceCheckResult = {
    hasValidInvoice : Bool; // true if valid existing invoice found
    invoiceData : ?Text; // invoice data if found
    amount : ?Nat; // amount if found
  };

  // Check if user has a valid existing invoice without requiring a token
  // This allows frontend to skip token request if invoice can be reused
  public query ({ caller }) func checkForValidInvoice() : async InvoiceCheckResult {
    Debug.print("[checkForValidInvoice] Called by: " # debug_show(caller));
    
    // Allow guests to query (will return hasValidInvoice = false)
    let currentTime = Time.now();
    let twentyFourHours : Int = 86_400_000_000_000;

    // Find the most recent unpaid invoice for the user
    var latestInvoice : ?InvoiceRecord = null;
    var latestTime : Int = 0;

    for ((_, invoice) in textMap.entries(userInvoices)) {
      if (invoice.user == caller and not invoice.isPaid) {
        if (invoice.createdAt > latestTime) {
          latestInvoice := ?invoice;
          latestTime := invoice.createdAt;
        };
      };
    };

    switch (latestInvoice) {
      case null {
        Debug.print("[checkForValidInvoice] No invoice found");
        {
          hasValidInvoice = false;
          invoiceData = null;
          amount = null;
        };
      };
      case (?invoice) {
        let timeDiff = currentTime - invoice.createdAt;
        let isValid = timeDiff <= twentyFourHours;
        Debug.print("[checkForValidInvoice] Invoice found, age: " # debug_show(timeDiff) # " ns, valid: " # debug_show(isValid));
        
        if (isValid) {
          {
            hasValidInvoice = true;
            invoiceData = ?invoice.invoiceData;
            amount = ?invoice.amount;
          };
        } else {
          {
            hasValidInvoice = false;
            invoiceData = null;
            amount = null;
          };
        };
      };
    };
  };

  // Get valid invoice or create new one
  // This function now only requires token when creating a new invoice
  // Returns invoice data, a flag indicating if it's a new invoice, and the amount
  public shared ({ caller }) func getValidOrCreateInvoice(token : ?Text) : async InvoiceResponse {
    Debug.print("[getValidOrCreateInvoice] Called by: " # debug_show(caller) # " with token: " # debug_show(token != null));
    
    // Auto-register guest users before proceeding
    ensureUserRole(caller);

    // User-level permission required
    if (not hasCallerPermission(caller, #user)) {
      Debug.trap("Unauthorized: Only users can create invoices");
    };

    let currentTime = Time.now();
    let twentyFourHours : Int = 86_400_000_000_000;

    // Capture current amount from config for potential new invoice
    let currentAmount = qpayInvoiceConfig.amount;
    Debug.print("[getValidOrCreateInvoice] Current config amount: " # debug_show(currentAmount));

    // Find the most recent unpaid invoice for the user
    var latestInvoice : ?InvoiceRecord = null;
    var latestTime : Int = 0;

    for ((_, invoice) in textMap.entries(userInvoices)) {
      if (invoice.user == caller and not invoice.isPaid) {
        if (invoice.createdAt > latestTime) {
          latestInvoice := ?invoice;
          latestTime := invoice.createdAt;
        };
      };
    };

    switch (latestInvoice) {
      case null {
        // No existing invoice, create new one - token is required
        Debug.print("[getValidOrCreateInvoice] No existing invoice, creating new");
        switch (token) {
          case null {
            Debug.trap("Token required to create new invoice");
          };
          case (?tkn) {
            Debug.print("[getValidOrCreateInvoice] Creating new invoice with token");
            let newInvoiceData = await makeQPayInvoiceRequest(tkn);
            Debug.print("[getValidOrCreateInvoice] New invoice created successfully");
            {
              invoiceData = newInvoiceData;
              isNewInvoice = true;
              amount = currentAmount;
            };
          };
        };
      };
      case (?invoice) {
        let timeDiff = currentTime - invoice.createdAt;
        Debug.print("[getValidOrCreateInvoice] Found invoice, age: " # debug_show(timeDiff) # " ns");
        
        if (timeDiff <= twentyFourHours) {
          // Valid existing invoice - token NOT required, skip token request
          Debug.print("[getValidOrCreateInvoice] Reusing valid invoice " # invoice.invoiceId # " - Token not requested for reused invoice");
          {
            invoiceData = invoice.invoiceData;
            isNewInvoice = false;
            amount = invoice.amount;
          };
        } else {
          // Invoice expired, create new one - token is required
          Debug.print("[getValidOrCreateInvoice] Invoice expired, creating new");
          switch (token) {
            case null {
              Debug.trap("Token required to create new invoice");
            };
            case (?tkn) {
              Debug.print("[getValidOrCreateInvoice] Creating new invoice with token");
              let newInvoiceData = await makeQPayInvoiceRequest(tkn);
              Debug.print("[getValidOrCreateInvoice] New invoice created successfully");
              {
                invoiceData = newInvoiceData;
                isNewInvoice = true;
                amount = currentAmount;
              };
            };
          };
        };
      };
    };
  };

  // New function to check payment status and update invoice
  public shared ({ caller }) func checkPaymentStatus(token : Text, invoiceId : Text) : async Bool {
    Debug.print("[checkPaymentStatus] Called by: " # debug_show(caller) # " for invoice: " # invoiceId);
    
    // Auto-register guest users before proceeding
    ensureUserRole(caller);

    // User-level permission required
    if (not hasCallerPermission(caller, #user)) {
      Debug.trap("Unauthorized: Only users can check payment status");
    };

    let headers = [
      { name = "Authorization"; value = "Bearer " # token },
      { name = "Content-Type"; value = "application/json" },
    ];

    let body = "{
      \"object_type\": \"INVOICE\",
      \"object_id\": \"" # invoiceId # "\",
      \"offset\": {
        \"page_number\": 1,
        \"page_limit\": 100
      }
    }";

    let response = await OutCall.httpPostRequest("https://merchant.qpay.mn/v2/payment/check", headers, body, transform);

    // Check if payment is confirmed (count > 0)
    if (Text.contains(response, #text "count\":0")) {
      Debug.print("[checkPaymentStatus] Payment still pending for invoice " # invoiceId);
      return false;
    } else {
      // Update invoice status to paid
      switch (textMap.get(userInvoices, invoiceId)) {
        case null {
          Debug.print("[checkPaymentStatus] Invoice " # invoiceId # " not found in storage");
        };
        case (?invoice) {
          let updatedInvoice : InvoiceRecord = {
            user = invoice.user;
            invoiceId = invoice.invoiceId;
            invoiceData = invoice.invoiceData;
            createdAt = invoice.createdAt;
            isPaid = true;
            amount = invoice.amount;
          };
          userInvoices := textMap.put(userInvoices, invoiceId, updatedInvoice);
          Debug.print("[checkPaymentStatus] Invoice " # invoiceId # " marked as paid");
        };
      };
      return true;
    };
  };

  // Stripe integration
  transient var stripeConfiguration : ?Stripe.StripeConfiguration = null;

  public query func isStripeConfigured() : async Bool {
    return stripeConfiguration != null;
  };

  public shared ({ caller }) func setStripeConfiguration(config : Stripe.StripeConfiguration) : async () {
    if (not hasCallerPermission(caller, #admin)) {
      Debug.trap("Unauthorized: Only admins can perform this action");
    };
    stripeConfiguration := ?config;
  };

  private func getStripeConfiguration() : Stripe.StripeConfiguration {
    switch (stripeConfiguration) {
      case null Debug.trap("Stripe needs to be first configured");
      case (?value) value;
    };
  };

  public func getStripeSessionStatus(sessionId : Text) : async Stripe.StripeSessionStatus {
    await Stripe.getSessionStatus(getStripeConfiguration(), sessionId, transform);
  };

  public shared ({ caller }) func createCheckoutSession(items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
    // Add authorization check if needed.
    await Stripe.createCheckoutSession(getStripeConfiguration(), caller, items, successUrl, cancelUrl, transform);
  };
};

