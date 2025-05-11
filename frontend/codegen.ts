// frontend/codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: "schema.json", // This should be your unwrapped schema introspection JSON file in the frontend/ directory
  documents: "src/graphql/operations/**/*.graphql", // <-- KEY CHANGE: Points to your new .graphql operation files
  generates: {
    // Output path for the generated file
    "src/graphql/generated/graphql.ts": {
      plugins: [
        "typescript",             // Generates base TypeScript types from your schema
        "typescript-operations",  // Generates types for each operation (variables and results) AND the operation strings/ASTs
        "typed-document-node"     // Wraps the generated operations into TypedDocumentNode constants (e.g., AdminListUsersDocument)
      ],
      config: {
        skipTypename: false,        // Recommended to keep __typename for caching and client-side logic
        enumsAsTypes: true,         // Generates string literal union types for enums (e.g., export type MyEnum = "VAL1" | "VAL2";)
        strictScalars: true,        // Ensures scalars are treated strictly according to your schema's custom scalar types
        scalars: {                // Mapping for AWS AppSync specific scalar types to TypeScript types
          AWSDateTime: 'string',
          AWSDate: 'string',
          AWSTime: 'string',
          AWSJSON: 'string', // Or 'Record<string, unknown>' or 'any' depending on your preference
          AWSEmail: 'string',
          AWSURL: 'string',
          AWSPhone: 'string',
          AWSIPAddress: 'string',
          // Add any other custom scalars defined in your schema here
        },
        preResolveTypes: true,            // Important for correctly resolving complex types, fragments, etc.
        exportFragmentSpreadSubTypes: true, // Useful if you use fragment spreads
        dedupeFragments: true,            // Prevents duplicate fragment definitions if they exist
        // Ensure operation names are unique; codegen will use the names from your .graphql files
        // (e.g., 'query AdminListUsers {...}' will lead to 'AdminListUsersDocument')
      },
    },
  },
  hooks: { // Optional: runs Prettier on the generated files for consistent formatting
    afterAllFileWrite: ['prettier --write']
  },
  // ignoreNoDocuments: false, // Can be removed or set to false, as we now expect .graphql documents to be found
};

export default config;