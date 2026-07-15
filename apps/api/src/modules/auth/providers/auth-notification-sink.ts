import type {
  EmailVerificationNotificationCommand,
  PasswordResetNotificationCommand,
} from '@seneve/identity-application';

export interface AuthNotificationSink {
  emailVerificationRequested(command: EmailVerificationNotificationCommand): Promise<void>;
  passwordResetRequested(command: PasswordResetNotificationCommand): Promise<void>;
}

export class NoopAuthNotificationSink implements AuthNotificationSink {
  async emailVerificationRequested(): Promise<void> {
    return undefined;
  }

  async passwordResetRequested(): Promise<void> {
    return undefined;
  }
}
