import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { AuditService } from '../../audit/audit.service';

const GMAIL_SCOPES = ['https://mail.google.com/'];

@Injectable()
export class GmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  private createOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth environment variables are missing');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  // Design choice: we keep OAuth concerns isolated here for easy provider swaps later.
  generateAuthUrl(userId: string) {
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_SCOPES,
      prompt: 'consent',
      state: userId,
    });
  }

  async handleOAuthCallback(code: string, userId: string) {
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token || !tokens.expiry_date) {
      throw new Error('Missing OAuth tokens from Google');
    }

    let refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      const existing = await this.prisma.connectedAccount.findFirst({
        where: { userId, provider: 'gmail' },
      });
      refreshToken = existing
        ? this.encryption.decrypt(existing.refreshToken)
        : undefined;
    }

    if (!refreshToken) {
      throw new Error('Missing Gmail refresh token');
    }

    const encryptedAccess = this.encryption.encrypt(tokens.access_token);
    const encryptedRefresh = this.encryption.encrypt(refreshToken);

    await this.prisma.connectedAccount.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'gmail',
        },
      },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: new Date(tokens.expiry_date),
      },
      create: {
        userId,
        provider: 'gmail',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: new Date(tokens.expiry_date),
      },
    });

    await this.audit.log({ userId, action: 'gmail.connected' });
  }

  async getDecryptedTokens(userId: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, provider: 'gmail' },
    });

    if (!account) {
      return null;
    }

    return {
      accessToken: this.encryption.decrypt(account.accessToken),
      refreshToken: this.encryption.decrypt(account.refreshToken),
      expiresAt: account.expiresAt,
    };
  }

  async isConnected(userId: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, provider: 'gmail' },
      select: { id: true },
    });
    return Boolean(account);
  }

  async revoke(userId: string) {
    await this.prisma.connectedAccount.deleteMany({
      where: { userId, provider: 'gmail' },
    });
    await this.audit.log({ userId, action: 'gmail.revoked' });
  }

  async refreshAccessToken(userId: string) {
    const tokens = await this.getDecryptedTokens(userId);
    if (!tokens) {
      throw new Error('Gmail account not connected');
    }

    const client = this.createOAuthClient();
    client.setCredentials({ refresh_token: tokens.refreshToken });
    const { token } = await client.getAccessToken();
    const expiryDate = client.credentials.expiry_date;

    if (!token || !expiryDate) {
      return tokens;
    }

    const encryptedAccess = this.encryption.encrypt(token);
    await this.prisma.connectedAccount.updateMany({
      where: { userId, provider: 'gmail' },
      data: {
        accessToken: encryptedAccess,
        expiresAt: new Date(expiryDate),
      },
    });

    return {
      accessToken: token,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(expiryDate),
    };
  }
}
