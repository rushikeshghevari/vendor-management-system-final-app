import bcrypt from 'bcryptjs';
import { Schema, model, type Document, type Types } from 'mongoose';

import { env, isProduction } from '@/config/env';
import { ALL_ROLES, type Role } from '@/constants/roles';

export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  department?: Types.ObjectId;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    // Weak passwords (e.g. the dev Super Admin password "1") are only permitted outside production.
    password: { type: String, required: true, select: false, minlength: isProduction ? 8 : 1 },
    role: { type: String, enum: ALL_ROLES, required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    // sparse: multiple users with no phone are allowed; only *present* values must be unique.
    phone: { type: String, trim: true, unique: true, sparse: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, env.bcryptSaltRounds);
});

userSchema.methods.comparePassword = function comparePassword(candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser>('User', userSchema);
