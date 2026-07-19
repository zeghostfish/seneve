import { AuthCard } from '../../../components/auth/auth-card';
import { EmailVerificationPanel } from '../../../components/auth/email-verification-panel';

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Verify email">
      <EmailVerificationPanel />
    </AuthCard>
  );
}
