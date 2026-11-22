import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[Clean] UI error', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>An unexpected error occurred while displaying this screen.</Text>
          <Text style={styles.note}>Your local data is safe. Working offline is supported.</Text>
          <Pressable onPress={() => this.setState({ hasError: false })} style={styles.button}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f4f6fb' },
  title: { color: '#b91c1c', fontSize: 18, fontWeight: '800' },
  message: { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 8 },
  note: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  button: { backgroundColor: '#3157d5', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
