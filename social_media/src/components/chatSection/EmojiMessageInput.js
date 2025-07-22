import React, { useState, useRef } from "react";
import { IoSend } from "react-icons/io5";
import { BsEmojiSmile } from "react-icons/bs";
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data'; // ✅ required for v5+

const EmojiMessageInput = ({ socket, userId, currentChat, setMessages, messages }) => {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef(null);

  const sendMessage = async () => {
    try {
      if (message.trim() !== "") {
        const newMessage = {
          senderId: userId,
          receiverId: currentChat._id,
          content: message,
        };

        socket.emit("sendMessage", newMessage);
        setMessages([...messages, newMessage]);
        setMessage("");
        setShowEmojiPicker(false);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // ✅ V5 uses 'emoji.unified' or 'emoji.native'
  const handleEmojiSelect = (emoji) => {
    setMessage((prev) => prev + emoji.native);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-gray-800 p-4 rounded-b-xl flex items-center relative">
      <button
        className="text-white text-xl mr-2"
        onClick={() => setShowEmojiPicker((prev) => !prev)}
      >
        <BsEmojiSmile />
      </button>

      {showEmojiPicker && (
        <div className="absolute bottom-16 left-4 z-50">
          <Picker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            theme="dark"
            emojiSize={24}
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        placeholder="Type your message..."
        className="flex-grow p-2 rounded-lg outline-none bg-gray-700 text-white"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") sendMessage();
        }}
      />

      <button
        className="ml-3 bg-blue-600 p-2 rounded-full text-white text-xl hover:bg-blue-700"
        onClick={sendMessage}
      >
        <IoSend />
      </button>
    </div>
  );
};

export default EmojiMessageInput;
