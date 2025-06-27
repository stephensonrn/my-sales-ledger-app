// src/DocumentManager.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { generateClient } from 'aws-amplify/api';
import {
  View,
  Text,
  Loader,
  Alert,
  Button,
  Flex,
  Heading,
  Card,
  Icon,
} from '@aws-amplify/ui-react';
import { MdFileDownload } from 'react-icons/md';

const getUploadUrl = /* GraphQL */ `
  mutation GetUploadUrl($filename: String!, $contentType: String!) {
    getUploadUrl(filename: $filename, contentType: $contentType) {
      uploadUrl
      key
    }
  }
`;

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
};

interface DocumentManagerProps {
    userId?: string | null;
}

function DocumentManager({ userId = null }: DocumentManagerProps) {
    const [allFiles, setAllFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // --- THIS IS NEW (Part 1): State to control the view ---
    const [showAll, setShowAll] = useState(false);

    const fetchFiles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await client.graphql({ 
                query: listMyFiles,
                variables: { userId }
            });
            // Store the complete list of files
            setAllFiles(response.data.listMyFiles || []);
        } catch (err) {
            setError("Could not load documents. Please try refreshing.");
            console.error("Error listing files:", err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    // --- THIS IS NEW (Part 2): Memoized filter to get the files to display ---
    const displayedFiles = useMemo(() => {
        if (showAll) {
            return allFiles; // Show all files if toggled
        }
        // Otherwise, filter for the current month
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        return allFiles.filter(file => {
            const fileDate = new Date(file.lastModified);
            return fileDate.getFullYear() === currentYear && fileDate.getMonth() === currentMonth;
        });
    }, [allFiles, showAll]);

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
                <Flex justifyContent="space-between" alignItems="center">
                    <Heading level={5} marginBottom="small">
                        {showAll ? "All Uploaded Documents" : "This Month's Documents"}
                    </Heading>
                    {/* --- THIS IS NEW (Part 3): Toggle button --- */}
                    <Button onClick={() => setShowAll(!showAll)} size="small" variation="link">
                        {showAll ? "Show Current Month" : "Show All"}
                    </Button>
                </Flex>

                {loading && <Loader />}
                {!loading && displayedFiles.length === 0 && (
                    <Text>
                        {showAll ? "No documents have been uploaded." : "No documents uploaded this month."}
                    </Text>
                )}
                {!loading && displayedFiles.map(file => (
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

export default DocumentManager;
