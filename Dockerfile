# will build and put all code to /opt/app
FROM 890606282206.dkr.ecr.eu-west-1.amazonaws.com/core-server as builder

# a Node.js application container
FROM node:10-alpine
WORKDIR /opt/app

COPY --from=builder /opt/app /opt/app

# Expose API port to the outside
EXPOSE 3000

CMD ["npm", "start"]