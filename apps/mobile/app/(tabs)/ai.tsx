import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  message?: {
    id?: string;
    content?: string;
  };
  error?: string;
}

export default function AIScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Namaskara! I am Raya AI. How can I help you with temple information today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Format messages for API
      const apiMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      // Use production URL or dev proxy based on environment
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://www.srsmathaynk.com';

      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('You have sent too many messages. Please wait a moment before trying again.');
        } else if (response.status === 400) {
          throw new Error('Invalid request. Please try rephrasing your question.');
        } else {
          throw new Error('The temple server is currently unavailable. Please try again later.');
        }
      }

      const text = await response.text();
      let data: ChatResponse;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error('Received an unexpected response from the server.');
      }

      if (data.message && data.message.content) {
        setMessages(prev => [...prev, {
          id: data.message!.id || Date.now().toString(),
          role: 'assistant',
          content: data.message!.content!
        }]);
      } else {
        throw new Error('Received an empty response from the server.');
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || 'Sorry, I am having trouble connecting to the temple servers right now.';
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: errorMessage
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <View style={[
            styles.messageBubble,
            item.role === 'user' ? styles.userBubble : styles.botBubble
          ]}>
            <Text style={[
              styles.messageText,
              item.role === 'user' ? styles.userText : styles.botText
            ]}>{item.content}</Text>
          </View>
        )}
      />

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="Om Sri Raghavendraya Namaha..."
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="send" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 15 },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: '#800000',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  botBubble: {
    backgroundColor: 'white',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 }
  },
  messageText: { fontSize: 16 },
  userText: { color: 'white' },
  botText: { color: '#333' },
  inputArea: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 20,
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#D4AF37',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
