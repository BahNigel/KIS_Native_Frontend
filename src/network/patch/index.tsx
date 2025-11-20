/**
 * Patch Data Utility Function
 *
 * Description:
 * A reusable function to send PATCH requests to an API endpoint. It supports sending partial updates,
 * custom headers, and provides mechanisms to handle success/error messages. This function is 
 * designed for general-purpose usage across the project.
 *
 * Parameters:
 * - url (string): The API endpoint to send the PATCH request to.
 * - data (any): The partial data payload to be sent in the PATCH request body.
 * - options (PatchDataOptions): An object to configure various options for the PATCH operation:
 *   - headers (Record<string, string>): Custom headers to include in the API request.
 *   - messages (object): Customizable success and error messages:
 *     - success (string): Success message to return on successful operation.
 *     - error (string): Error message to return if the operation fails.
 *
 * Returns:
 * - A promise resolving to an object with the following properties:
 *   - success (boolean): Whether the operation succeeded.
 *   - data (any): The response data from the API.
 *   - message (string): A success or error message.
 *
 * Usage:
 * Call the function with the desired API URL, data payload, and optional configurations.
 * Example:
 * const result = await patchData('/api/users/1', { name: 'Jane Doe' }, { messages: { success: 'User updated successfully' } });
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from "@/src/services/apiService";

interface PatchDataOptions {
  headers?: Record<string, string>; // Custom headers for the API request
  messages?: {
    success?: string; // Custom success message
    error?: string; // Custom error message
  };
}

export const patchData = async (
  url: string,
  data: any,
  options: PatchDataOptions = {}
): Promise<any> => {
  const { headers = {}, messages = {} } = options;

  try {
    // Retrieve the user token from AsyncStorage for authorization
    const userToken = await AsyncStorage.getItem('userToken');
    const authHeaders = userToken ? { Authorization: `Bearer ${userToken}` } : {};

    // Send PATCH request to the API
    const response = await apiService.patch(url, data, {
      headers: { ...authHeaders, ...headers },
    });

    // Parse the API response
    const responseData = await response.json();

    // Check the API response status
    if (response.status === 200 || response.status === 204) {
      return { success: true, data: responseData, message: messages.success || 'Data updated successfully.' };
    } else {
      return { success: false, message: messages.error || 'Failed to update data.' };
    }
  } catch (error: any) {
    // Handle errors during the PATCH operation
    console.error(error);
    return { success: false, message: error.message || 'An error occurred while updating data.' };
  }
};
