import { randomUUID } from 'node:crypto';

import { prisma } from '../models/prisma';

// ---------------------------------------------------------------------------
// CustomFieldService — wraps CustomMatterField and CustomMatterFieldValue
// ---------------------------------------------------------------------------

export interface CustomFieldServiceOptions {}

export type CustomFieldType = 'text' | 'select' | 'date' | 'number' | 'boolean';

export interface CreateFieldInput {
  orgId: string;
  name: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export interface UpdateFieldInput {
  name?: string;
  type?: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export interface FieldWithValue {
  id: string;
  orgId: string;
  name: string;
  fieldType: string;
  options: string | null;
  required: boolean;
  createdAt: Date;
  values?: { matterId: string; value: string }[];
}

export interface FieldValueResult {
  fieldId: string;
  matterId: string;
  value: string;
}

export class CustomFieldService {
  constructor(opts: CustomFieldServiceOptions = {}) {}

  /**
   * Create a new custom matter field.
   */
  async createField(
    orgId: string,
    name: string,
    type: CustomFieldType,
    options?: string[],
    required?: boolean,
  ): Promise<FieldWithValue> {
    try {
      const field = await prisma.customMatterField.create({
        data: {
          id: randomUUID(),
          orgId,
          name,
          fieldType: type,
          options: options ? JSON.stringify(options) : null,
          required: required || false,
        },
      });
      return field as unknown as FieldWithValue;
    } catch (err) {
      console.error('[CustomFieldService] Failed to create field:', err);
      throw new Error(
        `Failed to create custom field: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Update an existing custom matter field.
   */
  async updateField(fieldId: string, updates: UpdateFieldInput): Promise<FieldWithValue> {
    try {
      const field = await prisma.customMatterField.update({
        where: { id: fieldId },
        data: {
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.type !== undefined && { fieldType: updates.type }),
          ...(updates.options !== undefined && { options: JSON.stringify(updates.options) }),
          ...(updates.required !== undefined && { required: updates.required }),
        },
      });
      return field as unknown as FieldWithValue;
    } catch (err) {
      console.error('[CustomFieldService] Failed to update field:', err);
      throw new Error(
        `Failed to update custom field: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * List custom fields for an organization.
   */
  async listFields(orgId: string): Promise<FieldWithValue[]> {
    try {
      const fields = await prisma.customMatterField.findMany({
        where: { orgId },
        orderBy: { name: 'asc' },
        include: {
          values: { select: { matterId: true, value: true } },
        },
      });
      return fields as unknown as FieldWithValue[];
    } catch (err) {
      console.error('[CustomFieldService] Failed to list fields:', err);
      return [];
    }
  }

  /**
   * Get a single custom field by id.
   */
  async getField(fieldId: string): Promise<FieldWithValue | null> {
    try {
      const field = await prisma.customMatterField.findUnique({
        where: { id: fieldId },
        include: {
          values: { select: { matterId: true, value: true } },
        },
      });
      return field as unknown as FieldWithValue | null;
    } catch (err) {
      console.error('[CustomFieldService] Failed to get field:', err);
      return null;
    }
  }

  /**
   * Delete a custom matter field.
   */
  async deleteField(fieldId: string): Promise<void> {
    try {
      await prisma.customMatterField.delete({
        where: { id: fieldId },
      });
    } catch (err) {
      console.error('[CustomFieldService] Failed to delete field:', err);
      throw new Error(
        `Failed to delete custom field: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Get or create a custom field value for a specific field + matter.
   */
  async getFieldValue(fieldId: string, matterId: string): Promise<FieldValueResult | null> {
    try {
      const value = await prisma.customMatterFieldValue.findUnique({
        where: {
          matterId_fieldId: { matterId, fieldId },
        },
        select: { fieldId: true, matterId: true, value: true },
      });
      return value;
    } catch (err) {
      console.error('[CustomFieldService] Failed to get field value:', err);
      return null;
    }
  }

  /**
   * Set (upsert) a custom field value for a specific field + matter.
   */
  async setFieldValue(fieldId: string, matterId: string, value: string): Promise<FieldValueResult> {
    try {
      const result = await prisma.customMatterFieldValue.upsert({
        where: {
          matterId_fieldId: { matterId, fieldId },
        },
        update: { value },
        create: {
          id: randomUUID(),
          fieldId,
          matterId,
          value,
        },
        select: { fieldId: true, matterId: true, value: true },
      });
      return result as unknown as FieldValueResult;
    } catch (err) {
      console.error('[CustomFieldService] Failed to set field value:', err);
      throw new Error(
        `Failed to set field value: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
