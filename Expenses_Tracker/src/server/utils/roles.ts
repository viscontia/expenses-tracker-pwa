/**
 * Role management utilities for user authorization
 */

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export interface UserWithRole {
  id: number;
  email: string;
  role: string;
  createdAt: Date;
  preferences?: any;
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: UserWithRole): boolean {
  return user.role === UserRole.ADMIN;
}

/**
 * Check if user has specific role
 */
export function hasRole(user: UserWithRole, role: UserRole): boolean {
  return user.role === role;
}

/**
 * Get user role enum from string
 */
export function getUserRole(roleString: string): UserRole {
  return Object.values(UserRole).includes(roleString as UserRole) 
    ? roleString as UserRole 
    : UserRole.USER;
}

/**
 * Validate if role string is valid
 */
export function isValidRole(role: string): boolean {
  return Object.values(UserRole).includes(role as UserRole);
}