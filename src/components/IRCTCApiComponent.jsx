import React, { useState, useEffect } from "react";
import {
  Table,
  Input,
  Button,
  Form,
  DatePicker,
  Select,
  message,
  Collapse,
} from "antd";
import moment from "moment";
import DirectedGraphVisualization from "./DirectedGraphVisualization";
import dayjs from "dayjs";
const { Option } = Select;
const { Panel } = Collapse;

const IRCTCConnectedPathsComponent = () => {
  const [form] = Form.useForm();
  const [results, setResults] = useState([]);
  const [groupedResults, setGroupedResults] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stationList, setStationList] = useState([]);
  const [graph, setGraph] = useState({});
  const [startNode, setStartNode] = useState(null);
  const [endNode, setEndNode] = useState(null);

  const groupSimilarPaths = (paths) => {
    const groupedPaths = {};
    paths.forEach((path) => {
      const key = path.map((berth) => `${berth.from}-${berth.to}`).join("|");
      if (!groupedPaths[key]) {
        groupedPaths[key] = {
          route: path.map((berth) => ({ from: berth.from, to: berth.to })),
          paths: [],
        };
      }
      groupedPaths[key].paths.push(path);
    });
    return Object.values(groupedPaths);
  };
  const getHeaders = () => {
    return {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en-GB;q=0.9,en;q=0.8,hi;q=0.7",
      Connection: "keep-alive",
      Cookie: "/* Your cookie string here */",
      Host: "www.irctc.co.in",
      Referer: "https://www.irctc.co.in/online-charts/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      bmirak: "webbm",
      greq: Date.now().toString(),
      "sec-ch-ua":
        '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
    };
  };

  const getStationName = (stationCode) => {
    const station = stationList.find((s) => s.stationCode === stationCode);
    return station ? station.stationName : stationCode;
  };

  const fetchTrainSchedule = async (trainNo) => {
    const scheduleResponse = await fetch(
      `https://www.irctc.co.in/eticketing/protected/mapps1/trnscheduleenquiry/${trainNo}`,
      {
        method: "GET",
        headers: getHeaders(),
      }
    );
    if (!scheduleResponse.ok) throw new Error("Failed to fetch train schedule");
    const scheduleData = await scheduleResponse.json();
    setStationList(scheduleData.stationList);
  };

  const handleTrainNoChange = async (value) => {
    if (value && value.length >= 5) {
      try {
        setLoading(true);
        await fetchTrainSchedule(value);
        setLoading(false);
      } catch (err) {
        message.error("Failed to fetch train schedule");
        setLoading(false);
      }
    }
  };

  const findConnectedPaths = (
    vacantBerths,
    sourceStation,
    destinationStation
  ) => {
    const graph = {};
    vacantBerths.forEach((berth) => {
      if (!graph[berth.from]) graph[berth.from] = [];
      graph[berth.from].push({ to: berth.to, berth });
    });

    console.log("graph", graph);
    const paths = [];
    setGraph(graph);
    const dfs = (current, destination, path = []) => {
      if (current === destination) {
        paths.push([...path]);
        return;
      }
      if (!graph[current]) return;

      for (const edge of graph[current]) {
        dfs(edge.to, destination, [...path, edge.berth]);
      }
    };

    dfs(sourceStation, destinationStation);
    return paths;
  };

  const [destinationStation,setdestinationStation] = useState()
  const handleSubmit = async (values) => {
    setError(null);
    setResults([]);
    setLoading(true);
    setdestinationStation(values.destinationStation)

    try {
      const sourceStationCode = stationList.find(
        (s) => s.stationName === values.sourceStation
      )?.stationCode;
      const destinationStationCode = stationList.find(
        (s) => s.stationName === values.destinationStation
      )?.stationCode;

      if (!sourceStationCode || !destinationStationCode)
        throw new Error("Invalid source or destination station");

      // API call to get vacant berths for the entire route
      const vacantBerthResponse = await fetch(
        "https://www.irctc.co.in/online-charts/api/vacantBerth",
        {
          method: "POST",
          headers: {
            ...getHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trainNo: values.trainNo,
            boardingStation: sourceStationCode,
            remoteStation: "MAQ",
            trainSourceStation: "MAQ",
            jDate: values.jDate.format("YYYY-MM-DD"),
            cls: values.cls,
            chartType: 1,
          }),
        }
      );

      if (!vacantBerthResponse.ok)
        throw new Error("Failed to fetch vacant berths");
      const vacantBerthData = await vacantBerthResponse.json();

      const connectedPaths = findConnectedPaths(
        vacantBerthData.vbd,
        sourceStationCode,
        destinationStationCode
      );
      setGroupedResults(groupSimilarPaths(connectedPaths));
      console.log("connectedPaths", connectedPaths);
      setResults(connectedPaths);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const renderGroupedPath = (group) => (
    <Collapse>
      <Panel
        header={group.route
          .map(
            (segment, index) =>
              `${index > 0 ? " → " : ""}${getStationName(
                segment.from
              )} to ${getStationName(segment.to)}`
          )
          .join("")}
        key={group.route
          .map((segment) => `${segment.from}-${segment.to}`)
          .join("|")}
      >
        <Table
          dataSource={group.paths}
          columns={[
            {
              title: "Path Details",
              dataIndex: "path",
              key: "path",
              render: (_, record) => (
                <div>
                  {record.map((berth, index) => (
                    <div key={index}>
                      {index > 0 && " → "}
                      {getStationName(berth.from)} to {getStationName(berth.to)}
                      (Coach: {berth.coachName}, Berth: {berth.berthNumber}{" "}
                      {berth.berthCode})
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
          pagination={false}
          rowKey={(record) =>
            record.map((b) => `${b.coachName}-${b.berthNumber}`).join("-")
          }
        />
      </Panel>
    </Collapse>
  );

  const columns = [
    {
      title: "Path",
      dataIndex: "path",
      key: "path",
      render: (_, record) => (
        <div>
          {record.map((berth, index) => (
            <div key={index}>
              {index > 0 && " → "}
              {getStationName(berth.from)} to {getStationName(berth.to)}
              (Coach: {berth.coachName}, Berth: {berth.berthNumber}{" "}
              {berth.berthCode})
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">IRCTC Connected Paths Finder</h1>
      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item
          name="trainNo"
          label="Train Number"
          rules={[
            { required: true, message: "Please input the train number!" },
          ]}
        >
          <Input onChange={(e) => handleTrainNoChange(e.target.value)} />
        </Form.Item>
        <Form.Item
          name="sourceStation"
          label="Source Station"
          rules={[
            { required: true, message: "Please select the source station!" },
          ]}
        >
          <Select
            showSearch
            placeholder="Select source station"
            optionFilterProp="children"
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
          >
            {stationList.map((station) => (
              <Option key={station.stationCode} value={station.stationName}>
                {station.stationName}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          name="destinationStation"
          label="Destination Station"
          rules={[
            {
              required: true,
              message: "Please select the destination station!",
            },
          ]}
        >
          <Select
            showSearch
            placeholder="Select destination station"
            optionFilterProp="children"
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
          >
            {stationList.map((station) => (
              <Option key={station.stationCode} value={station.stationName}>
                {station.stationName}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          name="jDate"
          label="Journey Date"
          rules={[
            { required: true, message: "Please select the journey date!" },
          ]}
        >
          <DatePicker minDate={dayjs().subtract('2','day')}  maxDate={dayjs()}/>
        </Form.Item>
        <Form.Item
          name="cls"
          label="Class"
          rules={[{ required: true, message: "Please select the class!" }]}
        >
          <Select>
            <Option value="SL">Sleeper (SL)</Option>
            <Option value="3A">AC 3 Tier (3A)</Option>
            <Option value="2A">AC 2 Tier (2A)</Option>
            <Option value="1A">AC First Class (1A)</Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Find Connected Paths
          </Button>
        </Form.Item>
      </Form>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p>{error}</p>
        </div>
      )}
      {groupedResults.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Connected Paths</h2>
          {groupedResults.map((group, index) => (
            <div key={index} className="mb-4">
              {renderGroupedPath(group)}
            </div>
          ))}
        </div>
      )}
      <Form.Item
        name="startNode"
        label="Start Node"
        rules={[{ required: true, message: "Please select the start node!" }]}
      >
        <Select onChange={(value) => setStartNode(value)}>
          {Object.keys(graph).map((node) => (
            <Option key={node} value={node}>
              {node}
            </Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        name="endNode"
        label="End Node"
        rules={[{ required: true, message: "Please select the end node!" }]}
      >
        <Select onChange={(value) => setEndNode(value)}>
          {Object.keys(graph).map((node) => (
            <Option key={node} value={node}>
              {node}
            </Option>
          ))}
        </Select>
      </Form.Item>
      {graph && Object.keys(graph).length > 0 && (
        <div className="mt-4 w-full">
          <h2 className="text-xl font-semibold mb-2">Graph Visualization</h2>
          <DirectedGraphVisualization
            graph={graph}
            startNode={startNode}
            endNode={endNode}
            getStationName={getStationName}
            destinationNode={destinationStation} // Add this line
          />
        </div>
      )}

      {/* {results.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Connected Paths</h2>
          <Table
            dataSource={results}
            columns={columns}
            rowKey={(record) =>
              record.map((b) => `${b.coachName}-${b.berthNumber}`).join("-")
            }
            pagination={{ pageSize: 400 }}
          />
        </div>
      )} */}
    </div>
  );
};

export default IRCTCConnectedPathsComponent;
