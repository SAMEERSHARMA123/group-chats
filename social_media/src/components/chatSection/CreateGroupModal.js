import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { CREATE_GROUP, SEARCH_USERS_FOR_GROUP, GET_ME } from '../../graphql/mutations';

const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [groupImage, setGroupImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const { data: currentUserData } = useQuery(GET_ME);
  const [createGroup, { loading }] = useMutation(CREATE_GROUP);
  const { data: searchResults, loading: searchLoading } = useQuery(SEARCH_USERS_FOR_GROUP, {
    variables: { query: debouncedSearchQuery },
    skip: debouncedSearchQuery.length < 2
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleMemberToggle = (user) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.id === user.id);
      if (exists) {
        return prev.filter(m => m.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
    // Clear search after selecting a user
    setSearchQuery('');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      setGroupImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setGroupImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) return;

    const inputData = {
      name: groupName.trim(),
      description: description.trim(),
      members: selectedMembers.map(m => m.id),
      isPrivate,
      groupImage: groupImage
    };

    console.log('🔍 Frontend - Creating group with input:', inputData);
    console.log('🔍 Frontend - Selected members:', selectedMembers);

    try {
      const { data } = await createGroup({
        variables: {
          input: inputData
        }
      });
      
      // Call parent callback with created group
      if (onGroupCreated && data?.createGroup) {
        onGroupCreated({
          id: data.createGroup._id,
          name: data.createGroup.name,
          isGroup: true,
          type: 'group',
          groupImage: data.createGroup.groupImage,
          profileImage: data.createGroup.groupImage, // For backward compatibility
          isOnline: false,
          members: data.createGroup.members,
          memberCount: data.createGroup.memberCount
        });
      }
      
      // Reset form
      setGroupName('');
      setDescription('');
      setSelectedMembers([]);
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setIsPrivate(false);
      setGroupImage(null);
      setImagePreview(null);
      onClose();
    } catch (error) {
      console.error('❌ Frontend - Error creating group:', error);
      console.error('❌ Frontend - Error details:', {
        message: error.message,
        graphQLErrors: error.graphQLErrors,
        networkError: error.networkError
      });
      alert(`Failed to create group: ${error.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[450px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Create New Group</h2>
        
        <form onSubmit={handleSubmit}>
          {/* Group Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Group Name *</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter group name"
              required
            />
          </div>

          {/* Group Image */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Group Image</label>
            <div className="flex items-center space-x-4">
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Group preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-purple-200 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center border-2 border-dashed border-purple-200">
                  <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="groupImage"
                />
                <label
                  htmlFor="groupImage"
                  className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {imagePreview ? 'Change Image' : 'Upload Image'}
                </label>
                <p className="text-xs text-gray-500 mt-1">Max 5MB, JPG/PNG only</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded-lg h-20 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Group description (optional)"
            />
          </div>

          {/* Privacy Setting */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mr-2"
              />
              Private Group
            </label>
          </div>

          {/* Member Search */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Add Members *</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pl-8 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Search users by name or username..."
              />
              <svg 
                className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Selected Members */}
            {selectedMembers.length > 0 && (
              <div className="mb-2">
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map(member => (
                    <span key={member.id} className="bg-purple-100 px-2 py-1 rounded text-sm">
                      {member.name}
                      <button
                        type="button"
                        onClick={() => handleMemberToggle(member)}
                        className="ml-1 text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            {debouncedSearchQuery.length >= 2 && (
              <div className="max-h-40 overflow-y-auto border rounded">
                {searchLoading ? (
                  <div className="p-4 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
                    <p className="mt-2">Searching users...</p>
                  </div>
                ) : searchResults?.searchUsers && searchResults.searchUsers.length > 0 ? (
                  searchResults.searchUsers
                    .filter(user => user.id !== currentUserData?.getMe?.id)
                    .map(user => (
                      <div
                        key={user.id}
                        onClick={() => handleMemberToggle(user)}
                        className="p-3 hover:bg-gray-100 cursor-pointer flex items-center transition-colors"
                      >
                        <img
                          src={user.profileImage || '/default-avatar.png'}
                          alt={user.name}
                          className="w-10 h-10 rounded-full mr-3 object-cover"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">@{user.username}</p>
                        </div>
                        {selectedMembers.find(m => m.id === user.id) && (
                          <span className="ml-auto text-purple-500 font-bold">✓</span>
                        )}
                      </div>
                    ))
                ) : debouncedSearchQuery.length >= 2 && !searchLoading ? (
                  <div className="p-4 text-center text-gray-500">
                    <p>No users found matching "{debouncedSearchQuery}"</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !groupName.trim() || selectedMembers.length === 0}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg disabled:opacity-50 hover:bg-purple-600"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;