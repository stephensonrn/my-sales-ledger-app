// FILE: src/DocumentManager.tsx (Updated)
// ==========================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateClient } from 'aws-amplify/api';
import { View, Text, Loader, Alert, Button, Flex, Heading, Card, Icon } from '@aws-amplify/ui-react';
import { MdFileDownload } from 'react-icons/md';

const getUploadUrl = /* GraphQL */ `
  mutation GetUploadUrl($filename: String!, $contentType: String!) {
    getUploadUrl(filename: $filename, contentType: $contentType) {
      uploadUrl
      key
    }
  }
`;

// --- THIS IS THE FIX (Part 1): Update the query to accept a userId variable ---
const listMyFiles = /* GraphQL */ `
  query ListMyFiles($userId: ID) {
    listMyFiles(userId: $userId) {
      key
      url
      filename
      size
      lastModified
    }
  }
`;

const client = generateClient();

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// --- THIS IS THE FIX (Part 2): The component now accepts an optional userId for admin view ---
interface DocumentManagerProps {
    userId?: string | null; // For admins to view a specific user's files
}

function DocumentManager({ userId = null }: DocumentManagerProps) {
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchFiles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // --- THIS IS THE FIX (Part 3): Pass the userId as a variable ---
            const response = await client.graphql({ 
                query: listMyFiles,
                variables: { userId } // Pass null for non-admins, pass the target ID for admins
            });
            setFiles(response.data.listMyFiles || []);
        } catch (err) {
            setError("Could not load documents.");
            console.error("Error listing files:", err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);
        try {
            const getUrlResponse = await client.graphql({
                query: getUploadUrl,
                variables: { filename: file.name, contentType: file.type }
            });

            const { uploadUrl } = getUrlResponse.data.getUploadUrl;

            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type }
            });

            if (!uploadResponse.ok) {
                throw new Error('Upload failed. Please check permissions and try again.');
            }
            await fetchFiles();
        } catch (err: any) {
            setError(err.message || "Upload failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View paddingTop="medium">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            />
            <Button onClick={() => fileInputRef.current?.click()} variation="primary" disabled={loading}>
                {loading ? 'Processing...' : 'Upload New Document'}
            </Button>
            {error && <Alert variation="error" isDismissible onDismiss={() => setError(null)} marginTop="small">{error}</Alert>}
            <View marginTop="large">
                <Heading level={5} marginBottom="small">Uploaded Documents</Heading>
                {loading && <Loader />}
                {!loading && files.length === 0 && <Text>No documents uploaded.</Text>}
                {!loading && files.map(file => (
                    <Card key={file.key} variation="outlined" marginBottom="small">
                        <Flex justifyContent="space-between" alignItems="center">
                            <Flex direction="column">
                                <Text fontWeight="bold">{file.filename}</Text>
                                <Text fontSize="small" color="font.secondary">
                                    {formatBytes(file.size)} - Uploaded: {new Date(file.lastModified).toLocaleDateString('en-GB')}
                                </Text>
                            </Flex>
                            <Button as="a" href={file.url} target="_blank" variation="link">
                                <Icon as={MdFileDownload} /> Download
                            </Button>
                        </Flex>
                    </Card>
                ))}
            </View>
        </View>
    );
};