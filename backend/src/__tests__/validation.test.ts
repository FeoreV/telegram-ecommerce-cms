import request from 'supertest';
import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';

const app = express();
app.use(express.json());

// Test route with validation
app.post('/test-validation', 
  [
    body('email').isEmail().withMessage('Invalid email'),
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('age').isInt({ min: 18 }).withMessage('Age must be at least 18')
  ],
  validate,
  (req, res) => {
    res.json({ success: true, data: req.body });
  }
);

describe('Validation Middleware', () => {
  it('should pass valid data', async () => {
    const validData = {
      email: 'test@example.com',
      name: 'John Doe',
      age: 25
    };

    const response = await request(app)
      .post('/test-validation')
      .send(validData)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject(validData);
  });

  it('should reject invalid email', async () => {
    const invalidData = {
      email: 'not-an-email',
      name: 'John Doe',
      age: 25
    };

    const response = await request(app)
      .post('/test-validation')
      .send(invalidData)
      .expect(400);

    expect(response.body.error).toContain('Invalid email');
  });

  it('should reject short name', async () => {
    const invalidData = {
      email: 'test@example.com',
      name: 'A',
      age: 25
    };

    const response = await request(app)
      .post('/test-validation')
      .send(invalidData)
      .expect(400);

    expect(response.body.error).toContain('Name must be at least 2 characters');
  });

  it('should reject underage', async () => {
    const invalidData = {
      email: 'test@example.com',
      name: 'John Doe',
      age: 16
    };

    const response = await request(app)
      .post('/test-validation')
      .send(invalidData)
      .expect(400);

    expect(response.body.error).toContain('Age must be at least 18');
  });

  it('should handle multiple validation errors', async () => {
    const invalidData = {
      email: 'not-email',
      name: 'A',
      age: 15
    };

    const response = await request(app)
      .post('/test-validation')
      .send(invalidData)
      .expect(400);

    expect(response.body.error).toContain('Invalid email');
    expect(response.body.error).toContain('Name must be at least 2 characters');
    expect(response.body.error).toContain('Age must be at least 18');
  });
});
