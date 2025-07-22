import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_GROUP_MESSAGES, SEND_GROUP_MESSAGE, GET_ME } from '../../graphql/mutations';
import socket from '../socket_io/Socket';
import { BsEmojiSmile } from "react-icons/bs";
import EmojiPicker from 'emoji-picker-react';

const GroupChat = ({ group, onBack }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { data: currentUserData } = useQuery(GET_ME);
  const { data: messagesData, loading } = useQuery(GET_GROUP_MESSAGES, {
    variables: { groupId: group.id, limit: 50, offset: 0 },
    skip: !group.id
  });

  const [sendGroupMessage] = useMutation(SEND_GROUP_MESSAGE);

  useEffect(() => {
    if (messagesData?.getGroupMessages) {
      setMessages(messagesData.getGroupMessages);
    }
  }, [messagesData]);

  useEffect(() => {
    if (group.id) {
      // Join group room
      socket.joinGroup(group.id);

      // Listen for new messages
      socket.on('newGroupMessage', (newMessage) => {
        if (newMessage.group._id === group.id) {
          setMessages(prev => [...prev, newMessage]);
        }
      });

      // Listen for typing indicators
      socket.on('groupUserTyping', ({ userId, userName, profileImage, isTyping: userIsTyping }) => {
        if (userId !== currentUserData?.getMe?.id) {
          setTypingUsers(prev => {
            if (userIsTyping) {
              return [...prev.filter(u => u.userId !== userId), { userId, userName, profileImage }];
            } else {
              return prev.filter(u => u.userId !== userId);
            }
          });
        }
      });

      return () => {
        socket.leaveGroup(group.id);
        socket.off('newGroupMessage');
        socket.off('groupUserTyping');
      };
    }
  }, [group.id, currentUserData?.getMe?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      await sendGroupMessage({
        variables: {
          groupId: group.id,
          content: message.trim(),
          messageType: 'text'
        }
      });
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      socket.sendGroupTyping(group.id, true, currentUserData?.getMe?.name);
      
      setTimeout(() => {
        setIsTyping(false);
        socket.sendGroupTyping(group.id, false, currentUserData?.getMe?.name);
      }, 2000);
    }
  };

  const handleEmojiSelect = (event, emojiObject) => {
    setMessage((prev) => prev + (emojiObject?.emoji || event?.emoji));
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    // Show full date and time in a readable format
    return date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center p-4 border-b bg-white shadow-sm">
        <button
          onClick={onBack}
          className="mr-3 p-2 rounded-full hover:bg-gray-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img
          src={group.groupImage || group.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=8B5CF6&color=fff`}
          alt={group.name}
          className="w-10 h-10 rounded-full mr-3 object-cover"
        />
        <div>
          <h3 className="font-semibold">{group.name}</h3>
          <p className="text-sm text-gray-500">{group.memberCount} members</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const senderId = msg.sender._id || msg.sender.id;
          const currentUserId = currentUserData?.getMe?.id;
          const isOwnMessage = senderId === currentUserId;
          return (
            <div
              key={msg._id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div className="flex flex-col items-start">
                {!isOwnMessage && (
                  <img
                    src={msg.sender.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender.name)}&background=8B5CF6&color=fff`}
                    alt={msg.sender.name}
                    className="w-7 h-7 rounded-full mb-1 object-cover"
                  />
                )}
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  isOwnMessage
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}>
                  {!isOwnMessage && (
                    <p className="text-xs font-semibold mb-1">{msg.sender.name}</p>
                  )}
                  <p>{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    isOwnMessage ? 'text-purple-100' : 'text-gray-500'
                  }`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 mb-2">
            {typingUsers.map((u) => (
              <img
                key={u.userId}
                src={u.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.userName)}&background=8B5CF6&color=fff`}
                alt={u.userName}
                className="w-6 h-6 rounded-full object-cover"
              />
            ))}
            <span className="text-sm text-gray-600">typing...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t bg-white">
        <div className="flex items-center space-x-2 relative">
          <input
            type="text"
            value={message}
            onChange={handleTyping}
            placeholder="Type a message..."
            className="flex-1 p-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
          />
          <button
            type="button"
            className="absolute right-16 text-2xl text-gray-500 hover:text-purple-500 focus:outline-none"
            style={{ background: 'none', border: 'none' }}
            tabIndex={-1}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
          >
            <BsEmojiSmile />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-14 right-16 z-50">
              <EmojiPicker
                onEmojiClick={handleEmojiSelect}
                theme="light"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={!message.trim()}
            className="p-3 bg-purple-500 text-white rounded-full hover:bg-purple-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default GroupChat;