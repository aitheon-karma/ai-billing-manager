#!/bin/bash

kubectl port-forward svc/ai-redis 6379 --namespace=ai-redis
