#!/usr/bin/env node

# TESTING GUIDE - Campus Placement App Implementations

## Test 1: PR Registration Request Flow ✅

### Prerequisites
- Backend running on http://localhost:5000
- Frontend running on http://localhost:3000
- MongoDB with empty PRAllowlist collection

### Steps
```
1. Navigate to: http://localhost:3000/request-pr-po (after routing is added)
2. Fill form:
   - Email: newpr@gct.ac.in
   - Role: Placement Representative
   - Department: CSE
   - Notes: (optional)
3. Click "Submit Request"

Expected Result:
✓ Form shows success message
✓ MongoDB PRAllowlist has new document with status: 'pending'
✓ PO receives email notification (check email)
✓ Button allows submitting another request

Test Passed: ✅ If all above are true
```

### Monitor
```bash
# Check MongoDB
mongo
use placement_app
db.prallowlists.find()

# Should show:
{
  "_id": ObjectId(),
  "email": "newpr@gct.ac.in",
  "role": "placement_representative",
  "status": "pending",
  "department": "CSE",
  "createdAt": ISODate()
}
```

---

## Test 2: PO Approval Flow ✅

### Prerequisites
- Completed Test 1 (pending request exists)
- Logged in as PO user (role: 'placement_officer')
- Token in localStorage

### Steps
```
1. Navigate to: http://localhost:3000/po-manage-registrations
2. Should see:
   - Stats showing: 1 Pending, 0 Approved, 0 Rejected
   - Table with newpr@gct.ac.in entry
   - "Approve" and "Reject" buttons
3. Click "Approve"
4. Confirm dialog: Click "OK"

Expected Result:
✓ Button changes to loading state (...)
✓ Page refreshes or request moves to Approved tab
✓ Email sent to newpr@gct.ac.in with approval message
✓ Stats update: 0 Pending, 1 Approved, 0 Rejected

Test Passed: ✅ If all above work
```

### Verify
```bash
# Check email received
# Check MongoDB
db.prallowlists.findOne({email: "newpr@gct.ac.in"})

# Should show:
{
  ...
  "status": "approved",
  "approvedBy": ObjectId(po_user_id),
  "approvedDate": ISODate()
}
```

---

## Test 3: Registration After Approval ✅

### Prerequisites
- Completed Test 2 (request approved)
- Not logged in yet

### Steps
```
1. Navigate to: http://localhost:3000/register
2. Fill form:
   - Name: New PR
   - Email: newpr@gct.ac.in
   - Password: ValidPass123!
   - Role: Placement Representative
3. Click Register

Expected Result:
✓ Registration succeeds
✓ Email verification sent
✓ Login page shown or success message
✗ No error "Email not approved" (means approval worked)

Test Failed If:
✗ Error: "Email not approved for PR registration"
   → Check Test 2, approval might not have worked

Test Passed: ✅ User can register
```

---

## Test 4: Registration Without Approval ❌

### Prerequisites
- Fresh email not in allowlist

### Steps
```
1. Create new email: "unapproveduser@gct.ac.in"
2. Navigate to register
3. Try to register as PR with that email
4. Click Register

Expected Result:
✗ Error message: "Email not approved for PR registration"
✓ Registration blocked
✓ Correct behavior

Test Passed: ✅ If error shown
```

---

## Test 5: Max 2 PO Limit ✅

### Prerequisites
- 2 POs already exist in User collection
- New email for testing: testpo3@gct.ac.in

### Steps
```
1. Create allowlist entry for testpo3@gct.ac.in with status='approved'
2. Try to register as PO with that email
3. Click Register

Expected Result:
✗ Error: "Maximum 2 Placement Officers allowed"
✓ Registration blocked
✓ Correct enforcement

Test Passed: ✅ If error shown
```

---

## Test 6: Student Dashboard Test Count ✅

### Prerequisites
- Logged in as student
- At least 1 test published and assigned

### Steps
```
1. Navigate to: http://localhost:3000/dashboard (StudentDashboard)
2. Look for stats cards at top
3. Find "Available Tests" card (indigo colored)
4. Should show number like "3" or "0"
5. Click the test card

Expected Result:
✓ Test count displays correctly
✓ Number matches actual tests in system
✓ Click navigates to PlacementPreparation component
✓ Shows test list

Test Failed If:
✗ "Available Tests" card not visible
   → Check StudentDashboard.jsx route integration
✗ Count is 0 but tests exist
   → Check /api/prep/tests/available endpoint

Test Passed: ✅ If card shows and is clickable
```

---

## Test 7: File Download Endpoint ✅

### Prerequisites
- Logged in as student with uploaded resume
- Resume filename known (e.g., 'resume-123456.pdf')
- Authorization token in localStorage

### Steps
```bash
# Using curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/profile/download/resume-123456.pdf \
  -o downloaded-resume.pdf

# Check file downloaded
file downloaded-resume.pdf
```

Expected Result:
```
✓ File downloads successfully
✓ File is valid PDF
✓ File size > 0 bytes
✓ No 403 Forbidden error

Test Failed If:
✗ Error 403: "You do not have access"
   → Resume filename not in user's profile
✗ Error 404: "File not found"
   → File doesn't exist on disk
```

### Also Test Security:
```bash
# Try to access another user's file (SHOULD FAIL)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/profile/download/other-user-resume.pdf

# Should return: 403 Forbidden
```

Expected Result:
```
✓ Returns 403 error
✓ Cannot access other user's files
✓ Security working

Test Failed If:
✗ File downloads (major security issue!)
```

### Directory Traversal Test:
```bash
# Try to escape uploads folder (SHOULD FAIL)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/profile/download/../../../etc/passwd

# Should return: 400 Bad Request
```

Expected Result:
```
✓ Returns 400 error
✓ Path traversal blocked
✓ Security working

Test Failed If:
✗ File content shows (major security issue!)
```

---

## Test 8: Email Validation ✅

### Prerequisites
- .env EMAIL_USER and EMAIL_PASS configured

### Steps
```
1. Try registering with non-institutional email:
   - Email: user@gmail.com
   - Role: Placement Representative
2. Click Register

Expected Result:
✗ Error: "PR/PO must use institutional email (@gct.ac.in)"
✓ Registration blocked
✓ Correct validation

Test Passed: ✅ If error shown
```

---

## Integration Testing Checklist

```
[ ] PRRegistrationRequest component renders
[ ] Form validation works (email, role required)
[ ] Submit creates allowlist entry
[ ] PO receives email notification
[ ] POAllowlistManager renders for PO users
[ ] Approve button updates status
[ ] Reject button works with reason
[ ] StudentDashboard fetches tests
[ ] Test card displays count
[ ] Test card is clickable
[ ] File download endpoint returns file
[ ] File download checks ownership
[ ] File download blocks directory traversal
[ ] Email validation on registration
[ ] Max 2 PO limit enforced
[ ] Routes integrated in App.js
[ ] Navigation buttons in Navbar
```

---

## Quick Test Commands

### 1. Check if routes exist
```bash
curl http://localhost:5000/api/auth/allowlist \
  -H "Authorization: Bearer test_token"
# Should return 401 (no valid token) not 404 (route not found)
```

### 2. Check if PRAllowlist model works
```bash
mongo
use placement_app
db.prallowlists.insert({
  email: "test@gct.ac.in",
  role: "placement_representative",
  status: "pending",
  department: "CSE"
})
db.prallowlists.find()
```

### 3. Check email configuration
```javascript
// In backend console
console.log("Email user:", process.env.EMAIL_USER);
console.log("Email pass:", process.env.EMAIL_PASS ? "SET" : "NOT SET");
// Should show your Gmail address
```

### 4. Check StudentDashboard integration
```javascript
// Open browser console in StudentDashboard
console.log("Available tests:", availableTests.length);
// Should show a number >= 0
```

---

## Debugging Tips

### "Email not approved" error during registration
```
→ Check PO actually approved the request
→ Check MongoDB PRAllowlist status is 'approved'
→ Check email is exact match (case-insensitive)
```

### PO doesn't see allowlist page
```
→ Check user.role === 'placement_officer' in database
→ Check auth token is valid
→ Check route protection in POAllowlistManager
```

### Download endpoint returns 403
```
→ Check filename is in user's profile.resume / profile.photo / etc
→ Check user is authenticated
→ Check token is valid
```

### Tests not showing in dashboard
```
→ Check /api/prep/tests/available endpoint
→ Check tests are created and published
→ Check test eligibility matches student
→ Check browser console for fetch errors
```

---

## Performance Notes

- Allowlist queries should be fast (indexed by email and status)
- File downloads stream directly (supports large files)
- Test fetching cached by axios (no redundant calls)
- Database queries optimized with projections

---

## Success Criteria

✅ All 8 tests pass
✅ No security warnings in console
✅ Email notifications received
✅ No 500 errors in server logs
✅ Database entries created correctly
✅ UI components render without errors
✅ Navigation between features works

---

**If all tests pass, you're ready to deploy! 🚀**
