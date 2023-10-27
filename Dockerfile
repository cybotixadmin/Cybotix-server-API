
# alt 1 Use Node.js image
FROM node:16

# alt 2 slimmed down image
#FROM gcr.io/distroless/nodejs


# Create and set a working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN npm install 

# Copy the app source code
COPY . .

# Expose the port the app will run on
EXPOSE 3000

# Command to run the application
CMD ["node", "app.js"]

