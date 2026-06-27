import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type {
  ApiResponse,
  CreateGoalRequest,
  CreateGoalResponse,
  DeleteGoalResponse,
  ListGoalsResponse,
  UpdateGoalRequest,
  UpdateGoalResponse,
  UserGoal,
  UserGoalCategory,
  UserGoalStatus
} from "@docops360/shared";

interface HttpApiEvent {
  body?: string | null;
  routeKey?: string;
  pathParameters?: {
    goalId?: string;
  };
  requestContext?: {
    requestId?: string;
    http?: {
      method?: string;
      path?: string;
    };
  };
}

interface HttpApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const region = process.env.AWS_REGION ?? "us-east-1";
const goalsTableName = process.env.GOALS_TABLE_NAME;
const dynamodb = new DynamoDBClient({ region });

const jsonHeaders = {
  "content-type": "application/json"
};

const goalStatuses = new Set<UserGoalStatus>(["active", "future", "archived"]);
const goalCategories = new Set<UserGoalCategory>([
  "family_admin",
  "moving_travel",
  "bills_finance",
  "finance_investment",
  "career",
  "hobby",
  "relationship",
  "others",
  "general"
]);

const response = (statusCode: number, body: unknown): HttpApiResponse => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(body)
});

const requestIdFor = (event: HttpApiEvent) => event.requestContext?.requestId ?? crypto.randomUUID();

const parseBody = <T>(event: HttpApiEvent): T => {
  if (!event.body) {
    return {} as T;
  }

  return JSON.parse(event.body) as T;
};

const requireGoalsTable = () => {
  if (!goalsTableName) {
    throw new Error("GOALS_TABLE_NAME is required.");
  }

  return goalsTableName;
};

const normaliseCategory = (category: unknown): UserGoalCategory => {
  if (typeof category === "string" && goalCategories.has(category as UserGoalCategory)) {
    return category as UserGoalCategory;
  }

  return "others";
};

const normaliseStatus = (status: unknown): UserGoalStatus => {
  if (typeof status === "string" && goalStatuses.has(status as UserGoalStatus)) {
    return status as UserGoalStatus;
  }

  return "active";
};

const toGoalRecord = (item: Record<string, unknown>): UserGoal => ({
  goalId: String(item.goalId),
  title: String(item.title ?? "Untitled goal"),
  category: normaliseCategory(item.category),
  status: normaliseStatus(item.status),
  priority:
    item.priority === "monitoring" || item.priority === "attention" || item.priority === "urgent"
      ? item.priority
      : "normal",
  description: String(item.description ?? ""),
  createdAt: item.createdAt ? String(item.createdAt) : undefined,
  updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
  archivedAt: item.archivedAt ? String(item.archivedAt) : undefined
});

const listGoals = async (): Promise<UserGoal[]> => {
  const result = await dynamodb.send(
    new ScanCommand({
      TableName: requireGoalsTable(),
      Limit: 100
    })
  );

  return (result.Items ?? [])
    .map((item) => toGoalRecord(unmarshall(item)))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
};

const getGoal = async (goalId: string): Promise<UserGoal | undefined> => {
  const result = await dynamodb.send(
    new GetItemCommand({
      TableName: requireGoalsTable(),
      Key: {
        goalId: { S: goalId }
      }
    })
  );

  return result.Item ? toGoalRecord(unmarshall(result.Item)) : undefined;
};

const putGoal = async (goal: UserGoal): Promise<UserGoal> => {
  await dynamodb.send(
    new PutItemCommand({
      TableName: requireGoalsTable(),
      Item: marshall(goal, { removeUndefinedValues: true })
    })
  );

  return goal;
};

const createGoal = async (request: CreateGoalRequest): Promise<UserGoal> => {
  const title = request.title?.trim();
  if (!title) {
    throw new Error("Goal title is required.");
  }

  const now = new Date().toISOString();
  return putGoal({
    goalId: "goal_" + crypto.randomUUID(),
    title,
    description: request.description?.trim() ?? "",
    category: normaliseCategory(request.category),
    status: normaliseStatus(request.status),
    priority: request.priority ?? "normal",
    createdAt: now,
    updatedAt: now,
    archivedAt: request.status === "archived" ? now : undefined
  });
};

const updateGoal = async (goalId: string, request: UpdateGoalRequest): Promise<UserGoal | undefined> => {
  const existingGoal = await getGoal(goalId);
  if (!existingGoal) {
    return undefined;
  }

  const nextStatus = request.status === undefined ? existingGoal.status : normaliseStatus(request.status);
  const now = new Date().toISOString();
  const nextGoal: UserGoal = {
    ...existingGoal,
    title: request.title?.trim() || existingGoal.title,
    description: request.description !== undefined ? request.description.trim() : existingGoal.description,
    category: request.category === undefined ? existingGoal.category : normaliseCategory(request.category),
    status: nextStatus,
    priority: request.priority ?? existingGoal.priority,
    updatedAt: now,
    archivedAt: nextStatus === "archived" ? existingGoal.archivedAt ?? now : undefined
  };

  return putGoal(nextGoal);
};

const deleteGoal = async (goalId: string): Promise<DeleteGoalResponse | undefined> => {
  const existingGoal = await getGoal(goalId);
  if (!existingGoal) {
    return undefined;
  }

  await dynamodb.send(
    new DeleteItemCommand({
      TableName: requireGoalsTable(),
      Key: {
        goalId: { S: goalId }
      }
    })
  );

  return { goalId };
};

export const handler = async (event: HttpApiEvent): Promise<HttpApiResponse> => {
  const requestId = requestIdFor(event);
  const method = event.requestContext?.http?.method ?? "GET";
  const goalId = event.pathParameters?.goalId;

  try {
    console.log(
      JSON.stringify({
        level: "info",
        message: "Goals API request",
        requestId,
        routeKey: event.routeKey,
        method,
        goalId
      })
    );

    if (method === "GET") {
      const body: ApiResponse<ListGoalsResponse> = {
        data: { goals: await listGoals() },
        requestId
      };

      return response(200, body);
    }

    if (method === "POST") {
      const body: ApiResponse<CreateGoalResponse> = {
        data: { goal: await createGoal(parseBody<CreateGoalRequest>(event)) },
        requestId
      };

      return response(201, body);
    }

    if (!goalId) {
      return response(400, { message: "Goal ID is required.", requestId });
    }

    if (method === "PATCH") {
      const goal = await updateGoal(goalId, parseBody<UpdateGoalRequest>(event));
      if (!goal) {
        return response(404, { message: "Goal not found.", requestId });
      }

      const body: ApiResponse<UpdateGoalResponse> = {
        data: { goal },
        requestId
      };

      return response(200, body);
    }

    if (method === "DELETE") {
      const deletedGoal = await deleteGoal(goalId);
      if (!deletedGoal) {
        return response(404, { message: "Goal not found.", requestId });
      }

      const body: ApiResponse<DeleteGoalResponse> = {
        data: deletedGoal,
        requestId
      };

      return response(200, body);
    }

    return response(405, { message: "Method not allowed.", requestId });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Goals API failed",
        requestId,
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      })
    );

    return response(500, {
      message: error instanceof Error ? error.message : "Goals API failed.",
      requestId
    });
  }
};
