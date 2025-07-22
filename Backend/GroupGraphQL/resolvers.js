const Group = require('../Models/Group');
const GroupMessage = require('../Models/GroupMessage');
const User = require('../Models/user');
const { uploadToCloudinary } = require('../Utils/cloudinary');

module.exports = {
  Query: {
    getUserGroups: async (_, { userId }) => {
      try {
        const groups = await Group.find({ members: userId })
          .populate('members', 'name username profileImage isOnline lastActive')
          .populate('admins', 'name username profileImage')
          .populate('createdBy', 'name username profileImage')
          .populate('lastMessage.sender', 'name username profileImage')
          .sort({ updatedAt: -1 });
        
        return groups;
      } catch (error) {
        throw new Error(`Error fetching user groups: ${error.message}`);
      }
    },

    getGroupMessages: async (_, { groupId, limit = 50, offset = 0 }) => {
      try {
        const messages = await GroupMessage.find({ 
          group: groupId, 
          isDeleted: false 
        })
          .populate('sender', 'name username profileImage')
          .populate('replyTo')
          .populate('readBy.user', 'name username profileImage')
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(offset);
        
        return messages.reverse(); // Return in chronological order
      } catch (error) {
        throw new Error(`Error fetching group messages: ${error.message}`);
      }
    },

    getGroupDetails: async (_, { groupId }) => {
      try {
        const group = await Group.findById(groupId)
          .populate('members', 'name username profileImage isOnline lastActive')
          .populate('admins', 'name username profileImage')
          .populate('createdBy', 'name username profileImage')
          .populate('lastMessage.sender', 'name username profileImage');
        
        if (!group) {
          throw new Error('Group not found');
        }
        
        return group;
      } catch (error) {
        throw new Error(`Error fetching group details: ${error.message}`);
      }
    },

    searchGroups: async (_, { query, limit = 10 }) => {
      try {
        const groups = await Group.find({
          $and: [
            { isPrivate: false },
            {
              $or: [
                { name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
              ]
            }
          ]
        })
          .populate('members', 'name username profileImage')
          .populate('admins', 'name username profileImage')
          .populate('createdBy', 'name username profileImage')
          .limit(limit);
        
        return groups;
      } catch (error) {
        throw new Error(`Error searching groups: ${error.message}`);
      }
    }
  },

  Mutation: {
    createGroup: async (_, { input }, { user, io }) => {
      try {
        console.log('🔍 CreateGroup called with input:', JSON.stringify(input, null, 2));
        console.log('🔍 User context:', user ? { id: user.id, name: user.name } : 'No user');
        
        if (!user || !user.id) {
          console.error('❌ Authentication required - no user in context or missing user.id');
          throw new Error('Authentication required');
        }

        // Validate input
        if (!input.name || input.name.trim().length === 0) {
          console.error('❌ Group name is required');
          throw new Error('Group name is required');
        }

        if (!input.members || input.members.length === 0) {
          console.error('❌ At least one member is required');
          throw new Error('At least one member is required');
        }

        // Validate member IDs
        const mongoose = require('mongoose');
        const invalidMembers = input.members.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidMembers.length > 0) {
          console.error('❌ Invalid member IDs:', invalidMembers);
          throw new Error('Invalid member IDs provided');
        }

        // Ensure creator is in members list
        const members = [...new Set([user.id, ...input.members])];
        console.log('🔍 Final members list:', members);
        
        // Handle group image upload
        let groupImageUrl = '';
        if (input.groupImage) {
          console.log('🔍 Uploading group image to Cloudinary...');
          try {
            // Create a custom upload function for group images
            const { createReadStream, filename, mimetype } = await input.groupImage;
            const stream = createReadStream();
            const chunks = [];
            
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            
            // Use sharp to resize and optimize the image
            const sharp = require('sharp');
            const streamifier = require('streamifier');
            const cloudinary = require('cloudinary').v2;
            
            const optimizedBuffer = await sharp(buffer)
              .resize({ width: 400, height: 400, fit: 'cover' })
              .jpeg({ quality: 80 })
              .toBuffer();
            
            groupImageUrl = await new Promise((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                {
                  resource_type: 'image',
                  folder: 'group_images',
                  format: 'jpg',
                  transformation: [
                    { width: 400, height: 400, crop: 'fill' },
                    { quality: 'auto' }
                  ]
                },
                (error, result) => {
                  if (error) {
                    reject(error);
                  } else {
                    resolve(result.secure_url);
                  }
                }
              );
              
              streamifier.createReadStream(optimizedBuffer).pipe(uploadStream);
            });
            console.log('✅ Group image uploaded successfully:', groupImageUrl);
          } catch (uploadError) {
            console.error('❌ Failed to upload group image:', uploadError);
            throw new Error('Failed to upload group image');
          }
        }
        
        const groupData = {
          name: input.name,
          description: input.description || '',
          groupImage: groupImageUrl,
          members,
          admins: [user.id],
          createdBy: user.id,
          isPrivate: input.isPrivate || false,
          maxMembers: input.maxMembers || 256
        };
        
        console.log('🔍 Creating group with data:', JSON.stringify(groupData, null, 2));
        const group = await Group.create(groupData);

        const populatedGroup = await Group.findById(group._id)
          .populate('members', 'name username profileImage')
          .populate('admins', 'name username profileImage')
          .populate('createdBy', 'name username profileImage');

        // Emit to all group members
        if (io) {
          members.forEach(memberId => {
            io.to(memberId).emit('groupCreated', populatedGroup);
          });
        }

        return populatedGroup;
      } catch (error) {
        console.error('❌ Error in createGroup resolver:', error);
        console.error('❌ Error stack:', error.stack);
        throw new Error(`Error creating group: ${error.message}`);
      }
    },

    sendGroupMessage: async (_, { groupId, content, messageType = 'text', media, replyTo }, { user, io }) => {
      try {
        if (!user) {
          throw new Error('Authentication required');
        }

        // Check if user is a member of the group
        const group = await Group.findById(groupId);
        if (!group || !group.members.includes(user.id)) {
          throw new Error('You are not a member of this group');
        }

        const message = await GroupMessage.create({
          group: groupId,
          sender: user.id,
          content,
          messageType,
          media,
          replyTo
        });

        // Update group's last message
        await Group.findByIdAndUpdate(groupId, {
          lastMessage: {
            content: content || `Sent a ${messageType}`,
            sender: user.id,
            timestamp: new Date()
          },
          updatedAt: new Date()
        });

        const populatedMessage = await GroupMessage.findById(message._id)
          .populate('sender', 'name username profileImage')
          .populate('group', 'name')
          .populate('replyTo');

        // Emit to all group members
        if (io) {
          group.members.forEach(memberId => {
            io.to(memberId.toString()).emit('newGroupMessage', populatedMessage);
          });
        }

        return populatedMessage;
      } catch (error) {
        throw new Error(`Error sending group message: ${error.message}`);
      }
    },

    addGroupMembers: async (_, { groupId, memberIds }, { user, io }) => {
      try {
        if (!user) {
          throw new Error('Authentication required');
        }

        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        // Check if user is admin
        if (!group.admins.includes(user.id)) {
          throw new Error('Only admins can add members');
        }

        // Check max members limit
        const newMemberCount = group.members.length + memberIds.length;
        if (newMemberCount > group.maxMembers) {
          throw new Error(`Cannot exceed maximum members limit of ${group.maxMembers}`);
        }

        // Add new members (avoid duplicates)
        const uniqueNewMembers = memberIds.filter(id => !group.members.includes(id));
        group.members.push(...uniqueNewMembers);
        await group.save();

        const updatedGroup = await Group.findById(groupId)
          .populate('members', 'name username profileImage')
          .populate('admins', 'name username profileImage');

        // Emit to all group members
        if (io) {
          group.members.forEach(memberId => {
            io.to(memberId.toString()).emit('groupMembersAdded', {
              group: updatedGroup,
              newMembers: uniqueNewMembers
            });
          });
        }

        return {
          success: true,
          message: `${uniqueNewMembers.length} members added successfully`,
          group: updatedGroup
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          group: null
        };
      }
    },

    removeGroupMember: async (_, { groupId, memberId }, { user, io }) => {
      try {
        if (!user) {
          throw new Error('Authentication required');
        }

        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        // Check if user is admin or removing themselves
        if (!group.admins.includes(user.id) && user.id !== memberId) {
          throw new Error('Only admins can remove members');
        }

        // Cannot remove the creator
        if (group.createdBy.toString() === memberId) {
          throw new Error('Cannot remove group creator');
        }

        // Remove member
        group.members = group.members.filter(id => id.toString() !== memberId);
        group.admins = group.admins.filter(id => id.toString() !== memberId);
        await group.save();

        const updatedGroup = await Group.findById(groupId)
          .populate('members', 'name username profileImage')
          .populate('admins', 'name username profileImage');

        // Emit to all group members
        if (io) {
          group.members.forEach(memberIdInGroup => {
            io.to(memberIdInGroup.toString()).emit('groupMemberRemoved', {
              group: updatedGroup,
              removedMember: memberId
            });
          });
          
          // Notify removed member
          io.to(memberId).emit('removedFromGroup', { group: updatedGroup });
        }

        return {
          success: true,
          message: 'Member removed successfully',
          group: updatedGroup
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          group: null
        };
      }
    },

    leaveGroup: async (_, { groupId }, { user, io }) => {
      try {
        if (!user) {
          throw new Error('Authentication required');
        }

        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        // Creator cannot leave, must transfer ownership first
        if (group.createdBy.toString() === user.id) {
          throw new Error('Group creator cannot leave. Transfer ownership first or delete the group.');
        }

        // Remove user from members and admins
        group.members = group.members.filter(id => id.toString() !== user.id);
        group.admins = group.admins.filter(id => id.toString() !== user.id);
        await group.save();

        const updatedGroup = await Group.findById(groupId)
          .populate('members', 'name username profileImage')
          .populate('admins', 'name username profileImage');

        // Emit to remaining group members
        if (io) {
          group.members.forEach(memberId => {
            io.to(memberId.toString()).emit('groupMemberLeft', {
              group: updatedGroup,
              leftMember: user.id
            });
          });
        }

        return {
          success: true,
          message: 'Left group successfully',
          group: updatedGroup
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          group: null
        };
      }
    },

    updateGroup: async (_, { groupId, name, description, groupImage }, { user, io }) => {
      try {
        if (!user) {
          throw new Error('Authentication required');
        }

        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        // Check if user is admin
        if (!group.admins.includes(user.id)) {
          throw new Error('Only admins can update group');
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (groupImage !== undefined) updateData.groupImage = groupImage;

        const updatedGroup = await Group.findByIdAndUpdate(
          groupId,
          updateData,
          { new: true }
        )
          .populate('members', 'name username profileImage')
          .populate('admins', 'name username profileImage')
          .populate('createdBy', 'name username profileImage');

        // Emit to all group members
        if (io) {
          group.members.forEach(memberId => {
            io.to(memberId.toString()).emit('groupUpdated', updatedGroup);
          });
        }

        return updatedGroup;
      } catch (error) {
        throw new Error(`Error updating group: ${error.message}`);
      }
    },

    deleteGroup: async (_, { groupId }, { user, io }) => {
      try {
        if (!user) {
          throw new Error('Authentication required');
        }

        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        // Only creator can delete group
        if (group.createdBy.toString() !== user.id) {
          throw new Error('Only group creator can delete the group');
        }

        // Delete all group messages
        await GroupMessage.deleteMany({ group: groupId });
        
        // Delete the group
        await Group.findByIdAndDelete(groupId);

        // Emit to all group members
        if (io) {
          group.members.forEach(memberId => {
            io.to(memberId.toString()).emit('groupDeleted', { groupId });
          });
        }

        return {
          success: true,
          message: 'Group deleted successfully',
          group: null
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          group: null
        };
      }
    },

    makeGroupAdmin: async (_, { groupId, memberId }, { user, io }) => {
      try {
        if (!user) {
          throw new Error('Authentication required');
        }

        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        // Check if user is admin
        if (!group.admins.includes(user.id)) {
          throw new Error('Only admins can promote members');
        }

        // Check if member exists in group
        if (!group.members.includes(memberId)) {
          throw new Error('User is not a member of this group');
        }

        // Add to admins if not already
        if (!group.admins.includes(memberId)) {
          group.admins.push(memberId);
          await group.save();
        }

        const updatedGroup = await Group.findById(groupId)
          .populate('members', 'name username profileImage')
          .populate('admins', 'name username profileImage');

        // Emit to all group members
        if (io) {
          group.members.forEach(memberIdInGroup => {
            io.to(memberIdInGroup.toString()).emit('groupAdminAdded', {
              group: updatedGroup,
              newAdmin: memberId
            });
          });
        }

        return {
          success: true,
          message: 'Member promoted to admin successfully',
          group: updatedGroup
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          group: null
        };
      }
    },

    markGroupMessageAsRead: async (_, { messageId }, { user }) => {
      try {
        if (!user) {
          throw new Error('Authentication required');
        }

        const message = await GroupMessage.findById(messageId);
        if (!message) {
          throw new Error('Message not found');
        }

        // Check if already read by user
        const alreadyRead = message.readBy.some(read => read.user.toString() === user.id);
        
        if (!alreadyRead) {
          message.readBy.push({
            user: user.id,
            readAt: new Date()
          });
          await message.save();
        }

        return await GroupMessage.findById(messageId)
          .populate('sender', 'name username profileImage')
          .populate('readBy.user', 'name username profileImage');
      } catch (error) {
        throw new Error(`Error marking message as read: ${error.message}`);
      }
    }
  },

  // Field resolvers
  Group: {
    memberCount: (group) => group.members.length
  },
  GroupMessage: {
    createdAt: (msg) => msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
    updatedAt: (msg) => msg.updatedAt instanceof Date ? msg.updatedAt.toISOString() : msg.updatedAt,
  }
};
