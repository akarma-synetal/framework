# Email Verification Resend Implementation

## Summary

Implemented email verification resend functionality to fix the UX issue where users who miss or delete their verification email are permanently locked out.

## Changes

### 1. New Route: `/verify-email-prompt`

**File**: `apps/account/src/routes/verify-email-prompt.tsx`

A dedicated page that:
- Shows clear messaging about email verification requirement
- Displays the email address that needs verification
- Provides a "Resend verification email" button
- Includes back-to-login navigation
- Shows helpful tips (check spam folder, contact support)

**Features**:
- Calls better-auth's `/api/v1/auth/send-verification-email` endpoint
- Disabled state after successful resend to prevent spam
- Clear success/error feedback with toast notifications
- Responsive design matching existing auth pages

### 2. Login Page Enhancement

**File**: `apps/account/src/routes/login.tsx`

Modified login error handling to:
- Detect "email not verified" errors from better-auth
- Automatically redirect to `/verify-email-prompt` with email pre-filled
- Preserve original redirect target in URL params

### 3. Register Page Enhancement

**File**: `apps/account/src/routes/register.tsx`

Modified registration flow to:
- Detect when email verification is required after signup
- Redirect to `/verify-email-prompt` instead of hanging on loading screen
- Handle both registration success and refresh-time verification detection

## Technical Details

### Better-Auth Integration

Uses better-auth 1.6.11's built-in `/send-verification-email` endpoint:

```typescript
POST /api/v1/auth/send-verification-email
{
  "email": "user@example.com",
  "callbackURL": "/"  // Where to redirect after verification
}
```

This endpoint is automatically available when `emailVerification` is configured in AuthManager (already done in `control-plane-preset.ts`).

### URL Flow

```
1. User tries to login with unverified email
   → Login fails with "email not verified" error
   
2. Auto-redirect to: /verify-email-prompt?email=user@example.com&redirect=/dashboard
   
3. User clicks "Resend verification email"
   → POST /api/v1/auth/send-verification-email
   → Email sent with verification link
   
4. User clicks link in email
   → GET /api/v1/auth/verify-email?token=...&callbackURL=/dashboard
   → Email marked as verified, user auto-signed-in
   → Redirected to /dashboard
```

## Testing

### Manual Testing Checklist

- [ ] **Fresh signup flow**:
  1. Register new account
  2. Should redirect to `/verify-email-prompt`
  3. Email should be pre-filled
  4. Click "Resend" → success toast
  5. Check inbox for verification email
  6. Click verification link → auto-login

- [ ] **Missed email flow**:
  1. Register but don't verify
  2. Try to login → blocked
  3. Should redirect to `/verify-email-prompt`
  4. Click "Resend" → success toast
  5. Verify → login works

- [ ] **Error handling**:
  1. Try to resend with invalid email → error toast
  2. Try to resend with network error → error toast
  3. Multiple clicks on "Resend" → button disabled after success

- [ ] **Redirect preservation**:
  1. Try to access `/dashboard` while logged out
  2. Redirected to login with `?redirect=/dashboard`
  3. Login fails (unverified)
  4. Redirected to verification prompt with `?redirect=/dashboard`
  5. After verification, should land on `/dashboard`

### Automated Testing (TODO)

```typescript
// Example test case
test('login with unverified email redirects to verification prompt', async () => {
  const { navigate } = renderLoginPage();
  
  mockAuthClient.login.mockRejectedValue(
    new Error('Email not verified. Please check your inbox.')
  );
  
  await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'password123');
  await userEvent.click(screen.getByText('Sign in'));
  
  expect(navigate).toHaveBeenCalledWith({
    to: '/verify-email-prompt',
    search: { email: 'test@example.com' }
  });
});
```

## Deployment Considerations

### Environment Variables

No new env vars required. Uses existing:
- `OS_AUTH_REQUIRE_EMAIL_VERIFICATION` (already set in control-plane-preset)
- `OS_EMAIL_*` (SMTP credentials, already configured)

### Database

No schema changes required. Uses existing better-auth `sys_user.email_verified` field.

### Backwards Compatibility

✅ Fully backwards compatible:
- If `OS_AUTH_REQUIRE_EMAIL_VERIFICATION=false`, the new page is never shown
- Existing verified users are unaffected
- Users can still verify via the original email link

### Rollout Plan

1. **Deploy to staging**:
   - Test fresh signup flow
   - Test login with unverified account
   - Verify email delivery

2. **Manually verify production users**:
   ```sql
   -- Check how many users are locked
   SELECT COUNT(*) FROM sys_user WHERE email_verified = false;
   
   -- Optionally auto-verify existing users (one-time migration)
   UPDATE sys_user 
   SET email_verified = true, email_verified_at = CURRENT_TIMESTAMP
   WHERE created_at < '2026-05-27' AND email_verified = false;
   ```

3. **Deploy to production**:
   - Bump framework SHA in cloud repo
   - Deploy cloud container
   - Monitor for error logs

## Known Limitations

1. **Error message detection**: Uses string matching to detect "email not verified" errors. If better-auth changes error messages, this may break. Consider adding an error code check.

2. **No rate limiting**: The resend button can be clicked multiple times (after cooldown). Consider adding backend rate limiting.

3. **No email confirmation**: We trust better-auth's 200 response means email was sent. No client-side verification of actual delivery.

## Follow-up Items

- [ ] Add translation strings for all new i18n keys
- [ ] Add automated E2E tests
- [ ] Consider adding email rate limiting (e.g., max 3 resends per hour)
- [ ] Monitor production metrics for:
  - Verification email send rate
  - Verification completion rate
  - Time between signup and verification

## Related Issues

- Fixes: Users permanently locked out after missing verification email (reported by user on 2026-05-27)
- Related commit: `6daa8c8` (feat: require email verification on signup)
