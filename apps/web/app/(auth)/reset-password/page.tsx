import { AuthCard } from '../../../components/auth/auth-card';
import { PasswordResetCompletionForm } from '../../../components/auth/password-reset-forms';

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose new password">
      <PasswordResetCompletionForm />
    </AuthCard>
  );
}
