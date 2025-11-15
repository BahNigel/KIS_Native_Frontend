// src/screens/chat/contactsService.ts

export type KISDeviceContact = {
  id: string;
  name: string;
  phone: string;
};

export type KISContact = KISDeviceContact & {
  isRegistered: boolean;
};

/**
 * Load device contacts, then mark which are registered on KIS.
 */
export async function refreshFromDeviceAndBackend(): Promise<KISContact[]> {
  // 1) Get device contacts (TODO: use react-native-contacts)
  const deviceContacts = await getDeviceContactsFromDevice();

  // 2) Ask backend which numbers are on KIS
  const marked = await markRegisteredOnBackend(deviceContacts);
  return marked;
}

// Fake device contacts for now (so UI works without extra setup)
export async function getDeviceContactsFromDevice(): Promise<KISDeviceContact[]> {
  // TODO: replace with react-native-contacts implementation
  return [
    { id: '1', name: 'Alice Johnson', phone: '+237 600000001' },
    { id: '2', name: 'Bob Smith', phone: '+237 600000002' },
    { id: '3', name: 'Charlie Doe', phone: '+237 600000003' },
    { id: '4', name: 'Diana Prince', phone: '+237 600000004' },
  ];
}

// Stub backend call – mark some as registered / not
export async function markRegisteredOnBackend(
  deviceContacts: KISDeviceContact[],
): Promise<KISContact[]> {
  // TODO: real API call: POST /kis/contacts/lookup { phones: [...] }
  // Here we pretend: even IDs => registered, odd => not (by index)
  return deviceContacts.map((c, idx) => ({
    ...c,
    isRegistered: idx % 2 === 0,
  }));
}

// Stub for saving contact to device
export async function saveContactToDevice(payload: {
  name: string;
  phone: string;
  countryCode: string;
}): Promise<void> {
  // TODO: implement with react-native-contacts addContact
  console.log('Saving contact to device (stub):', payload);
}
