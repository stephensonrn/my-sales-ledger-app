import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersCommandOutput,
  AdminListGroupsForUserCommand,
  AdminListGroupsForUserCommandOutput,
  UserType,
} from '@aws-sdk/client-cognito-identity-provider';

import MailComposer from 'mailcomposer'; // Add typings via @types/mailcomposer or manual declaration

const USER_POOL_ID = process.env.USER_POOL_ID;
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';
const ADMIN_GROUP_NAME = process.env.ADMIN_GROUP_NAME || 'Admins';

if (!USER_POOL_ID) {
  throw new Error('Missing environment variable USER_POOL_ID');
}

const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

/**
 * Check if a given user is part of the admin group.
 * @param username Cognito username
 * @returns Promise resolving to true if user is admin, false otherwise
 */
export const isUserAdmin = async (username: string): Promise<boolean> => {
  if (!username) return false;

  try {
    const command = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      Limit: 10,
    });
    const response: AdminListGroupsForUserCommandOutput = await cognitoClient.send(command);

    return response.Groups?.some((group) => group.GroupName === ADMIN_GROUP_NAME) ?? false;
  } catch (error) {
    console.error(`Error checking admin status for user ${username}:`, error);
    // Fallback to false on error to avoid accidentally granting admin rights
    return false;
  }
};

/**
 * List all users in the user pool, handling pagination internally.
 * @returns Promise resolving to an array of Cognito UserType objects
 */
export const listAllUsers = async (): Promise<UserType[]> => {
  let paginationToken: string | undefined = undefined;
  const allUsers: UserType[] = [];

  do {
    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      PaginationToken: paginationToken,
      Limit: 50,
    });

    const response: ListUsersCommandOutput = await cognitoClient.send(command);

    if (response.Users) {
      allUsers.push(...response.Users);
    }

    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return allUsers;
};

/**
 * Sends an email using MailComposer.
 * Customize the email options as needed.
 * @param options MailComposer options (from, to, subject, text, etc.)
 * @returns Promise that resolves when email is built (and sent if integrated)
 */
export const sendMail = (options: {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const mail = new MailComposer(options);

    mail.compile().build((err, message) => {
      if (err) {
        console.error('Error building email:', err);
        reject(err);
      } else {
        // Here you would send the message with an email transport (e.g., SES, SMTP)
        // For now, resolve the raw email message Buffer
        resolve(message);
      }
    });
  });
};

/**
 * Example Lambda handler function stub.
 * Customize this to:
 * - verify caller/admin status
 * - gather user data
 * - compose and send report emails
 */
export const handler = async (event: any) => {
  console.log('Received event:', JSON.stringify(event));

  // TODO: Add authentication/authorization check here (e.g. isUserAdmin)

  const users = await listAllUsers();

  console.log(`Fetched ${users.length} users from Cognito.`);

  // Compose an email report here (example)
  const emailMessage = await sendMail({
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Monthly Report',
    text: `We have ${users.length} users in the user pool.`,
  });

  console.log(`Email built, length: ${emailMessage.length} bytes`);

  // TODO: Send email via SES or SMTP here

  return {
    statusCode: 200,
    body: `Monthly report prepared for ${users.length} users.`,
  };
};
