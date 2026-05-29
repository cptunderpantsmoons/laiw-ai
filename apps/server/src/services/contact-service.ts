import { randomUUID } from 'node:crypto';

import { prisma } from '../models/prisma';

// ---------------------------------------------------------------------------
// ContactService — wraps Contact model (CRM contacts)
// ---------------------------------------------------------------------------

export interface ContactServiceOptions {}

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  userId: string;
}

export interface UpdateContactInput {
  name?: string;
  email?: string;
  phone?: string;
}

export class ContactService {
  constructor(opts: ContactServiceOptions = {}) {
    // No mutable state needed — all operations go through Prisma.
  }

  /**
   * Create a new contact for a user.
   */
  async createContact(
    name: string,
    email?: string,
    phone?: string,
    userId?: string,
  ): Promise<{ contactId: string }> {
    try {
      const contact = await prisma.contact.create({
        data: {
          name,
          email: email || null,
          phone: phone || null,
          userId: userId ?? '',
        },
      });
      return { contactId: contact.id };
    } catch (err) {
      console.error('[ContactService] Failed to create contact:', err);
      throw new Error(
        `Failed to create contact: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Update an existing contact's fields.
   */
  async updateContact(contactId: string, updates: UpdateContactInput): Promise<void> {
    try {
      await prisma.contact.update({
        where: { id: contactId },
        data: updates,
      });
    } catch (err) {
      console.error('[ContactService] Failed to update contact:', err);
      throw new Error(
        `Failed to update contact: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * List contacts, optionally filtered by userId and/or orgId.
   */
  async listContacts(userId?: string, orgId?: string): Promise<any[]> {
    try {
      const where: Record<string, unknown> = {};
      if (userId) where.userId = userId;

      return prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
    } catch (err) {
      console.error('[ContactService] Failed to list contacts:', err);
      return [];
    }
  }

  /**
   * Get a single contact by id, or null if not found.
   */
  async getContact(contactId: string): Promise<any | null> {
    try {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
      return contact;
    } catch (err) {
      console.error('[ContactService] Failed to get contact:', err);
      return null;
    }
  }

  /**
   * Delete a contact.
   */
  async deleteContact(contactId: string): Promise<void> {
    try {
      await prisma.contact.delete({
        where: { id: contactId },
      });
    } catch (err) {
      console.error('[ContactService] Failed to delete contact:', err);
      throw new Error(
        `Failed to delete contact: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
