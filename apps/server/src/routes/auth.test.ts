import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the models and prisma
vi.mock('../models/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../models/user', () => ({
  registerUser: vi.fn(),
  verifyLogin: vi.fn(),
}));

import authRouter from './auth';
import { registerUser, verifyLogin } from '../models/user';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test' as string | null,
  lastName: 'User' as string | null,
  passwordHash: 'hashed-password',
  role: 'ADMIN' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: null as string | null,
};

describe('Auth Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/auth/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      vi.mocked(registerUser).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });
      expect(registerUser).toHaveBeenCalledWith('newuser@example.com', 'password123', 'New', 'User');
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'email and password required');
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'email and password required');
    });

    it('should return 400 when registration fails', async () => {
      vi.mocked(registerUser).mockRejectedValue(new Error('Email already exists'));

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email already exists');
    });

    it('should register without optional name fields', async () => {
      vi.mocked(registerUser).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'minimal@example.com', password: 'password' });

      expect(res.status).toBe(201);
      expect(registerUser).toHaveBeenCalledWith('minimal@example.com', 'password', undefined, undefined);
    });
  });

  describe('POST /login', () => {
    it('should login successfully and return a token', async () => {
      vi.mocked(verifyLogin).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'user-1');
      expect(res.body).toHaveProperty('email', 'test@example.com');
      expect(res.body).toHaveProperty('token');

      // Verify token is a JWT (three base64 parts separated by dots)
      const parts = res.body.token.split('.');
      expect(parts).toHaveLength(3);
    });
  });

  describe('Token validation', () => {
    it('should generate a JWT token structure', async () => {
      vi.mocked(verifyLogin).mockResolvedValue(mockUser);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      const token = res.body.token;
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      expect(header.alg).toBe('HS256');
    });
  });
});
