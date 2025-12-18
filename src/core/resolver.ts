/**
 * Member Resolver
 *
 * Provides pluggable member resolution for bulk operations.
 * Allows customization of how members are looked up by identifier.
 *
 * @module @classytic/clockin/core/resolver
 */

import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';
import { Container } from './container.js';
import type { OperationContext, AnyDocument, ObjectIdLike } from '../types.js';

/**
 * Member resolver interface.
 *
 * Implement this interface to customize how members are resolved by identifier
 * in bulk operations.
 *
 * @example
 * ```typescript
 * // Custom resolver that looks up by membership code
 * class MembershipCodeResolver implements MemberResolver {
 *   constructor(private container: Container) {}
 *
 *   async resolve(
 *     identifier: string,
 *     targetModel: string,
 *     context: OperationContext
 *   ): Promise<AnyDocument | null> {
 *     const Model = this.container.get<mongoose.Model<any>>('models')[targetModel];
 *     return Model.findOne({
 *       organizationId: context.organizationId,
 *       membershipCode: identifier,
 *     });
 *   }
 * }
 * ```
 */
export interface MemberResolver<TMember = AnyDocument> {
  /**
   * Resolve a member by identifier.
   *
   * @param identifier - User-provided identifier (email, code, id, etc.)
   * @param targetModel - The target model name
   * @param context - Operation context with organizationId, session, etc.
   * @returns The resolved member document, or null if not found
   */
  resolve(
    identifier: string,
    targetModel: string,
    context: OperationContext
  ): Promise<TMember | null>;
}

/**
 * Default member resolver options.
 */
export interface DefaultMemberResolverOptions {
  /**
   * Fields to search for the identifier, in order of priority.
   *
   * The resolver will try each field until a match is found.
   *
   * @default ['customer.email', 'email', 'membershipCode', 'employeeId', '_id']
   */
  identifierFields?: string[];

  /**
   * Whether to try parsing the identifier as an ObjectId.
   * If true and the identifier is a valid ObjectId, it will also search by _id.
   *
   * @default true
   */
  tryObjectId?: boolean;
}

/**
 * Default member resolver.
 *
 * Looks up members by trying multiple identifier fields in sequence.
 * This is the default resolver used when no custom resolver is provided.
 *
 * @example
 * ```typescript
 * const resolver = new DefaultMemberResolver(container, {
 *   identifierFields: ['membershipCode', 'customer.email', 'email'],
 * });
 *
 * const member = await resolver.resolve('MEM-001', 'Membership', context);
 * ```
 */
export class DefaultMemberResolver implements MemberResolver {
  private container: Container;
  private options: Required<DefaultMemberResolverOptions>;

  constructor(container: Container, options: DefaultMemberResolverOptions = {}) {
    this.container = container;
    this.options = {
      identifierFields: options.identifierFields || [
        'customer.email',
        'email',
        'membershipCode',
        'employeeId',
        '_id',
      ],
      tryObjectId: options.tryObjectId !== false,
    };
  }

  /**
   * Get model from container (supports multi-connection setups)
   */
  private getModel(targetModel: string): mongoose.Model<any> {
    const models = this.container.has('models')
      ? this.container.get<Record<string, mongoose.Model<any>>>('models')
      : {};

    if (models[targetModel]) {
      return models[targetModel];
    }

    throw new Error(
      `Model "${targetModel}" is not registered in ClockIn. Register it via .withModels({ ${targetModel} })`
    );
  }

  /**
   * Check if a string is a valid ObjectId.
   */
  private isValidObjectId(str: string): boolean {
    if (!this.options.tryObjectId) return false;
    return mongoose.Types.ObjectId.isValid(str) && String(new mongoose.Types.ObjectId(str)) === str;
  }

  async resolve(
    identifier: string,
    targetModel: string,
    context: OperationContext
  ): Promise<AnyDocument | null> {
    const Model = this.getModel(targetModel);
    const session = context.session as ClientSession | undefined;

    // If identifier is a valid ObjectId, try _id first
    if (this.isValidObjectId(identifier)) {
      let query = Model.findOne({
        organizationId: context.organizationId,
        _id: new mongoose.Types.ObjectId(identifier),
      });
      if (session) {
        query = query.session(session);
      }
      const result = await query;
      if (result) return result;
    }

    // Try each identifier field in order
    for (const field of this.options.identifierFields) {
      // Skip _id if we already tried it above
      if (field === '_id' && this.isValidObjectId(identifier)) continue;

      const queryObj: Record<string, unknown> = {
        organizationId: context.organizationId,
        [field]: identifier,
      };

      let query = Model.findOne(queryObj);
      if (session) {
        query = query.session(session);
      }

      const member = await query;
      if (member) return member;
    }

    return null;
  }
}

/**
 * Composite resolver that tries multiple resolvers in sequence.
 *
 * Useful when you have multiple resolution strategies.
 *
 * @example
 * ```typescript
 * const resolver = new CompositeResolver([
 *   new MembershipCodeResolver(container),
 *   new EmailResolver(container),
 *   new DefaultMemberResolver(container),
 * ]);
 * ```
 */
export class CompositeResolver implements MemberResolver {
  constructor(private resolvers: MemberResolver[]) {}

  async resolve(
    identifier: string,
    targetModel: string,
    context: OperationContext
  ): Promise<AnyDocument | null> {
    for (const resolver of this.resolvers) {
      const result = await resolver.resolve(identifier, targetModel, context);
      if (result) return result;
    }
    return null;
  }
}

/**
 * Factory function to create a resolver based on configuration.
 *
 * @param container - DI container
 * @param options - Resolver options
 * @returns Configured member resolver
 */
export function createResolver(
  container: Container,
  options?: DefaultMemberResolverOptions
): MemberResolver {
  return new DefaultMemberResolver(container, options);
}
