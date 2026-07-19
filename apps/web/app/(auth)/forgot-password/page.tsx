import { AuthCard } from '../../../components/auth/auth-card';
import { PasswordResetRequestForm } from '../../../components/auth/password-reset-forms';

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset password">
      <PasswordResetRequestForm />
    </AuthCard>
  );
}
