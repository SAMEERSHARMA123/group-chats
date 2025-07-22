const { gql } = require("apollo-server-express");

module.exports = gql`
  scalar Upload
  type Group {
    _id: ID!
    name: String!
    description: String
    groupImage: String
    members: [User!]!
    admins: [User!]!
    createdBy: User!
    isPrivate: Boolean!
    maxMembers: Int!
    lastMessage: LastMessage
    memberCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  type LastMessage {
    content: String
    sender: User
    timestamp: String
  }

  type GroupMessage {
    _id: ID!
    group: Group!
    sender: User!
    content: String
    messageType: String!
    media: Media
    replyTo: GroupMessage
    isEdited: Boolean!
    editedAt: String
    isDeleted: Boolean!
    deletedAt: String
    readBy: [ReadStatus!]!
    createdAt: String!
    updatedAt: String!
  }

  type ReadStatus {
    user: User!
    readAt: String!
  }

  type Media {
    url: String
    type: String
    filename: String
    size: Int
  }

  type GroupMembershipResult {
    success: Boolean!
    message: String!
    group: Group
  }

  extend type Query {
    getUserGroups(userId: ID!): [Group!]!
    getGroupMessages(groupId: ID!, limit: Int, offset: Int): [GroupMessage!]!
    getGroupDetails(groupId: ID!): Group
    searchGroups(query: String!, limit: Int): [Group!]!
  }

  input MediaInput {
    url: String
    type: String
    filename: String
    size: Int
  }

  input CreateGroupInput {
    name: String!
    description: String
    groupImage: Upload
    members: [ID!]!
    isPrivate: Boolean
    maxMembers: Int
  }

  extend type Mutation {
    createGroup(input: CreateGroupInput!): Group!
    sendGroupMessage(
      groupId: ID!, 
      content: String, 
      messageType: String, 
      media: MediaInput,
      replyTo: ID
    ): GroupMessage!
    addGroupMembers(groupId: ID!, memberIds: [ID!]!): GroupMembershipResult!
    removeGroupMember(groupId: ID!, memberId: ID!): GroupMembershipResult!
    leaveGroup(groupId: ID!): GroupMembershipResult!
    updateGroup(
      groupId: ID!, 
      name: String, 
      description: String, 
      groupImage: String
    ): Group!
    deleteGroup(groupId: ID!): GroupMembershipResult!
    makeGroupAdmin(groupId: ID!, memberId: ID!): GroupMembershipResult!
    removeGroupAdmin(groupId: ID!, memberId: ID!): GroupMembershipResult!
    markGroupMessageAsRead(messageId: ID!): GroupMessage!
    editGroupMessage(messageId: ID!, content: String!): GroupMessage!
    deleteGroupMessage(messageId: ID!): GroupMessage!
  }


`;
